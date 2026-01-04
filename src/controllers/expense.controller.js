const Expense = require("../models/Expense");
const FestivalYear = require("../models/FestivalYear");
const { logAction } = require("../utils/auditLogger");
// 1. ADD EXPENSE (Log the Request)
exports.addExpense = async (req, res) => {
  try {
    const { title, amount, category, description, date } = req.body;
    const { clubId, role } = req.user; 

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active festival year." });

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

    // ✅ LOG 1: EXPENSE CREATED
    // We log whether it was auto-approved (Admin) or just requested (Member)
    const actionType = role === "admin" ? "CREATE_EXPENSE_APPROVED" : "CREATE_EXPENSE_REQUEST";
    
    await logAction({
      req,
      action: actionType,
      target: `Expense: ${title} (₹${amount})`,
      details: { 
        expenseId: newExpense._id, 
        category, 
        status: initialStatus 
      }
    });

    res.status(201).json({ 
      success: true, 
      data: newExpense,
      message: role === "admin" ? "Expense added." : "Expense submitted for approval."
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// 2. APPROVE / REJECT (Log the Decision)
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only Admins can approve expenses." });
    }

    // Update the expense
    const expense = await Expense.findByIdAndUpdate(
      id, 
      { status }, 
      { new: true }
    );

    if (!expense) return res.status(404).json({ message: "Expense not found" });

    // ✅ LOG 2: STATUS CHANGE
    // This provides the critical "Audit Trail" of who authorized the money.
    await logAction({
      req,
      action: `EXPENSE_${status.toUpperCase()}`, // e.g., EXPENSE_APPROVED
      target: `Expense: ${expense.title}`,
      details: { 
        amount: expense.amount,
        expenseId: expense._id,
        newStatus: status
      }
    });

    res.json({ success: true, data: expense });

  } catch (err) {
    console.error(err);
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
    const { id } = req.params;
    const { clubId } = req.user;

    // 1. Find and Delete in one step (returns the deleted doc)
    const expense = await Expense.findOneAndDelete({ _id: id, club: clubId });

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // ✅ LOG THE DELETION
    // We can now safely access expense.title and expense.amount
    await logAction({
      req,
      action: "DELETE_EXPENSE",
      target: `Deleted: ${expense.title}`,
      details: { 
        amount: expense.amount, 
        category: expense.category 
      }
    });

    res.json({ success: true, message: "Expense deleted" });

  } catch (err) {
    console.error("Delete Expense Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};