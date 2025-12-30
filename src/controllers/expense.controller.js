const Expense = require("../models/Expense");

/* ===== LIST ===== */
exports.list = async (req, res) => {
  const expenses = await Expense.find().sort({ createdAt: -1 });
  res.json({ success: true, data: expenses });
};

/* ===== CREATE ===== */
exports.create = async (req, res) => {
  try {
    const { title, amount } = req.body;

    if (!title || !amount) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const expense = await Expense.create({
      title,
      amount,
      addedBy: req.user.id, // ✅ FIX
      status: "pending",
    });

    res.json({ success: true, data: expense });
  } catch (err) {
    console.error("expense create error", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ===== APPROVE ===== */
exports.approve = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    if (expense.status === "approved") {
      return res.status(400).json({ message: "Already approved" });
    }

    expense.status = "approved";
    await expense.save();

    res.json({ success: true });
  } catch (err) {
    console.error("approve error", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ===== REJECT ===== */
exports.reject = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    expense.status = "rejected";
    await expense.save();

    res.json({ success: true });
  } catch (err) {
    console.error("reject error", err);
    res.status(500).json({ message: "Server error" });
  }
};
