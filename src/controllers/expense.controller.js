const Expense = require("../models/Expense");
const FestivalYear = require("../models/FestivalYear");

// 1. ADD EXPENSE
exports.addExpense = async (req, res) => {
  try {
    const { title, amount, category, description, date } = req.body;
    const { clubId, role } = req.user; 

    // Get Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active festival year." });

    // Admins approve instantly, Members stay pending
    const initialStatus = role === "admin" ? "approved" : "pending";

    const newExpense = await Expense.create({
      club: clubId,
      year: activeYear._id,
      title,
      amount,
      category,
      description,
      date: date || new Date(),
      status: initialStatus,
      recordedBy: req.user.id
    });

    res.status(201).json({ 
      success: true, 
      data: newExpense,
      message: role === "admin" ? "Expense added." : "Expense submitted for approval."
    });

  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

// 2. APPROVE / REJECT EXPENSE
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; 

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only Admins can approve expenses." });
    }

    const expense = await Expense.findByIdAndUpdate(
      id, 
      { status }, 
      { new: true }
    );

    res.json({ success: true, data: expense });

  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

// 3. GET EXPENSES (Fixed: Only show Active Year)
exports.getExpenses = async (req, res) => {
  try {
    const { clubId } = req.user;

    // ✅ FIX: Find the Active Year first
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });

    // If no active year (closed), return empty list (clears the UI)
    if (!activeYear) {
      return res.json({ success: true, data: [] });
    }

    // ✅ FIX: Filter expenses by this Active Year ID
    const expenses = await Expense.find({ 
        club: clubId,
        year: activeYear._id 
      })
      .populate("recordedBy", "name")
      .sort({ date: -1 });
      
    res.json({ success: true, data: expenses });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

// 4. DELETE EXPENSE
exports.deleteExpense = async (req, res) => {
  try {
    await Expense.findOneAndDelete({ _id: req.params.id, club: req.user.clubId });
    res.json({ success: true, message: "Expense deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};