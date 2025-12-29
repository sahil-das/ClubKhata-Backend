const FinancialYear = require("../models/FinancialYear");
const Weekly = require("../models/WeeklyContribution");
const Puja = require("../models/PujaContribution");
const Donation = require("../models/Donation");
const Expense = require("../models/Expense");

/**
 * GET /api/history/:year
 * Year-wise financial summary (READ-ONLY)
 */
exports.getYearSummary = async (req, res) => {
  try {
    const year = Number(req.params.year);

    const fy = await FinancialYear.findOne({ year });
    if (!fy) {
      return res.status(404).json({ message: "Financial year not found" });
    }

    // Weekly total (year stored as Number)
    const weekly = await Weekly.aggregate([
      { $match: { year } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Puja total (year stored as ObjectId)
    const puja = await Puja.aggregate([
      { $match: { year: fy._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Donation total
    const donations = await Donation.aggregate([
      { $match: { year } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Expense total
    const expenses = await Expense.aggregate([
      { $match: { year } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.json({
      success: true,
      data: {
        year,
        openingBalance: fy.openingBalance,
        weeklyTotal: weekly[0]?.total || 0,
        pujaTotal: puja[0]?.total || 0,
        donationTotal: donations[0]?.total || 0,
        expenseTotal: expenses[0]?.total || 0,
        closingBalance: fy.closingBalance,
        isClosed: fy.isClosed,
      },
    });
  } catch (err) {
    console.error("History summary error:", err);
    res.status(500).json({ message: "Failed to load history data" });
  }
};
