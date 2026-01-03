const mongoose = require("mongoose"); // ✅ Import Mongoose
const Subscription = require("../models/Subscription");
const MemberFee = require("../models/MemberFee");
const Donation = require("../models/Donation");
const Expense = require("../models/Expense");

module.exports = async (yearId, openingBalance = 0) => {
  try {
    // ✅ CRITICAL FIX: Cast yearId to ObjectId for Aggregation
    // Aggregations DO NOT auto-cast strings to IDs. We must do it manually.
    const id = new mongoose.Types.ObjectId(yearId);

    // 1. Subscriptions
    const subStats = await Subscription.aggregate([
      { $match: { year: id } }, // Using casted ID
      { $group: { _id: null, total: { $sum: "$totalPaid" } } }
    ]);

    // 2. Member Fees (Chanda)
    const feeStats = await MemberFee.aggregate([
      { $match: { year: id } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    // 3. Donations
    const donationStats = await Donation.aggregate([
      { $match: { year: id } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    // 4. Expenses (Approved Only)
    const expenseStats = await Expense.aggregate([
      { $match: { year: id, status: "approved" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const income = (subStats[0]?.total || 0) + (feeStats[0]?.total || 0) + (donationStats[0]?.total || 0);
    const expense = expenseStats[0]?.total || 0;

    const total = (Number(openingBalance) || 0) + income - expense;
    
    console.log(`💰 Balance Calc for Year ${id}: Open=${openingBalance} + Inc=${income} - Exp=${expense} = ${total}`);
    
    return total;

  } catch (err) {
    console.error("Balance Calculation Error:", err);
    return 0;
  }
};