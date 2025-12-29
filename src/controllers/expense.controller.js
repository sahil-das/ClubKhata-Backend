const Expense = require("../models/Expense");

/* ================= LIST ================= */
exports.list = async (req, res) => {
  try {
    const { year } = req.query;

    const expenses = await Expense.find({ year }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: expenses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ================= CREATE ================= */
exports.create = async (req, res) => {
  try {
    const { title, amount, year } = req.body;

    await Expense.create({
      title,
      amount,
      year,
      status: "pending",
    });

    res.json({
      success: true,
      message: "Expense added",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ================= APPROVE ================= */
exports.approve = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    expense.status = "approved";
    await expense.save();

    res.json({
      success: true,
      message: "Expense approved",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
