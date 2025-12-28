// utils/calculateBalance.js
const Weekly = require("../models/WeeklyContribution");
const Puja = require("../models/PujaContribution");
const Donation = require("../models/Donation");
const Expense = require("../models/Expense");

module.exports = async (year, openingBalance) => {
  const weekly = await Weekly.aggregate([
    { $match: { year } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);

  const puja = await Puja.aggregate([
    { $match: { year } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);

  const donations = await Donation.aggregate([
    { $match: { year } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);

  const expenses = await Expense.aggregate([
    { $match: { year, status: "approved" } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);

  return (
    openingBalance +
    (weekly[0]?.total || 0) +
    (puja[0]?.total || 0) +
    (donations[0]?.total || 0) -
    (expenses[0]?.total || 0)
  );
};
