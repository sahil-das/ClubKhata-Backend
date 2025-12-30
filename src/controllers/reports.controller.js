const WeeklyPayment = require("../models/WeeklyPayment");
const Expense = require("../models/Expense");
const PujaCycle = require("../models/PujaCycle");
const Donation = require("../models/Donation");
const PujaContribution = require("../models/PujaContribution");
/* ================= WEEKLY TOTAL ================= */
exports.weeklyTotal = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({
      $or: [{ isActive: true }, { active: true }],
    }).lean();

    if (!cycle) {
      return res.json({ total: 0 });
    }

    // 🔥 FORCE number conversion safely
    const weeklyAmount = parseInt(cycle.weeklyAmount, 10);

    if (isNaN(weeklyAmount)) {
      console.error("Invalid weeklyAmount:", cycle.weeklyAmount);
      return res.json({ total: 0 });
    }

    const payments = await WeeklyPayment.find({
      cycle: String(cycle._id),
    }).lean();

    let total = 0;

    for (const p of payments) {
      for (const w of p.weeks) {
        if (w.paid === true) {
          total += weeklyAmount;
        }
      }
    }

    res.json({ total });
  } catch (err) {
    console.error("weeklyTotal error", err);
    res.status(500).json({ total: 0 });
  }
};

/* ================= PUJA TOTAL ================= */
exports.pujaTotal = async (req, res) => {
  const contributions = await PujaContribution.find();
  const total = contributions.reduce(
    (sum, c) => sum + c.amount,
    0
  );

  res.json({ total });
};

/* ================= DONATION TOTAL ================= */
exports.donationTotal = async (req, res) => {
  const donations = await Donation.find();
  const total = donations.reduce(
    (sum, d) => sum + d.amount,
    0
  );

  res.json({ total });
};

/* ================= APPROVED EXPENSE TOTAL ================= */
exports.expenseTotal = async (req, res) => {
  const expenses = await Expense.find({ status: "approved" });
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  res.json({ total });
};
