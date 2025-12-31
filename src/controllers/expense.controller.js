const Expense = require("../models/Expense");
const PujaCycle = require("../models/PujaCycle");

/* ===== LIST (ACTIVE CYCLE) ===== */
exports.list = async (req, res) => {
  const cycle = await PujaCycle.findOne({ isActive: true });
  if (!cycle) return res.json({ success: true, data: [] });

  const expenses = await Expense.find({
    createdAt: {
      $gte: cycle.startDate,
      $lte: cycle.endDate,
    },
  }).sort({ createdAt: -1 });

  res.json({ success: true, data: expenses });
};

/* ===== CREATE ===== */
exports.create = async (req, res) => {
  const { title, amount } = req.body;
  if (!title || !amount) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const expense = await Expense.create({
    title,
    amount,
    addedBy: req.user._id,
    status: "pending",
  });

  res.json({ success: true, data: expense });
};

/* ===== APPROVE ===== */
exports.approve = async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) return res.status(404).json({ message: "Not found" });

  expense.status = "approved";
  await expense.save();
  res.json({ success: true });
};

/* ===== REJECT ===== */
exports.reject = async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) return res.status(404).json({ message: "Not found" });

  expense.status = "rejected";
  await expense.save();
  res.json({ success: true });
};
