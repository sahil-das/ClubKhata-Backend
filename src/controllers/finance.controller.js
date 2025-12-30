const WeeklyPayment = require("../models/WeeklyPayment");
const Expense = require("../models/Expense");
const PujaCycle = require("../models/PujaCycle");

exports.getCentralFund = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) {
      return res.json({ balance: 0 });
    }

    /* ===== TOTAL CONTRIBUTIONS ===== */
    const payments = await WeeklyPayment.find({ cycle: cycle._id });

    let totalContribution = 0;

    payments.forEach((p) => {
      p.weeks.forEach((w) => {
        if (w.paid) {
          totalContribution += cycle.weeklyAmount;
        }
      });
    });

    /* ===== TOTAL APPROVED EXPENSES ===== */
    const expenses = await Expense.find({
      status: "approved",
    });

    const totalExpense = expenses.reduce(
      (sum, e) => sum + e.amount,
      0
    );

    const balance = totalContribution - totalExpense;

    res.json({
      success: true,
      data: {
        totalContribution,
        totalExpense,
        balance,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Finance error" });
  }
};
