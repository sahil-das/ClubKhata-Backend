const FestivalYear = require("../models/FestivalYear");
const Subscription = require("../models/Subscription");
const MemberFee = require("../models/MemberFee");
const Donation = require("../models/Donation");
const Expense = require("../models/Expense");
const { toClient } = require("../utils/mongooseMoney"); // 👈 Use helper

exports.getSummary = async (req, res) => {
  try {
    const { clubId } = req.user;
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    
    if (!activeYear) {
      return res.json({
        success: true,
        data: {
          yearName: "No Active Year",
          totalIncome: "0.00",
          totalExpense: "0.00",
          balance: "0.00",
          breakdown: { subscriptions: "0.00", memberFees: "0.00", donations: "0.00" }
        }
      });
    }

    const yearId = activeYear._id;

    // 1. Subscriptions
    const subscriptionStats = await Subscription.aggregate([
      { $match: { club: clubId, year: yearId } },
      { $unwind: "$installments" },
      { $match: { "installments.isPaid": true } },
      { $group: { _id: null, total: { $sum: "$installments.amountExpected" } } }
    ]);
    // 💰 RAW INTEGER (e.g. 500000)
    const rawSubs = subscriptionStats[0]?.total || 0;

    // 2. Member Fees
    const memberFeeStats = await MemberFee.aggregate([
      { $match: { club: clubId, year: yearId } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const rawFees = memberFeeStats[0]?.total || 0;

    // 3. Donations
    const donationStats = await Donation.aggregate([
      { $match: { club: clubId, year: yearId } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const rawDonations = donationStats[0]?.total || 0;

    // 4. Expenses
    const expenseStats = await Expense.aggregate([
      { $match: { club: clubId, year: yearId, status: "approved" } }, 
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const rawExpenses = expenseStats[0]?.total || 0;

    // 5. Calculations (ALL IN INTEGERS)
    const rawOpening = activeYear.openingBalance || 0; // Already int via Model? Check direct DB access if needed.
    // Note: Mongoose document access `activeYear.openingBalance` MIGHT return "500.00" string due to getter.
    // Safest to rely on `activeYear.toObject({ getters: false }).openingBalance` OR
    // re-parse it: Math.round(activeYear.openingBalance * 100) if it came out as float string.
    // Ideally, for math, access the raw value using `activeYear.get('openingBalance', null, { getters: false })` 
    
    // SIMPLER: Since we are in the controller and just fetched `activeYear`, the getter ran.
    // Let's reverse it to Int for math, or trust the `toClient` at the end.
    // BETTER: Recalculate cleanly.
    
    const openingInt = Math.round(parseFloat(activeYear.openingBalance) * 100); 

    const currentIncomeInt = rawSubs + rawFees + rawDonations;
    const totalBalanceInt = openingInt + currentIncomeInt - rawExpenses;

    res.json({
      success: true,
      data: {
        yearName: activeYear.name,
        // 💰 CONVERT BACK TO CLIENT FORMAT (String "500.00")
        openingBalance: toClient(openingInt),
        totalIncome: toClient(currentIncomeInt),
        totalExpense: toClient(rawExpenses),
        balance: toClient(totalBalanceInt),
        breakdown: {
          subscriptions: toClient(rawSubs),
          memberFees: toClient(rawFees),
          donations: toClient(rawDonations)
        }
      }
    });

  } catch (err) {
    console.error("Finance Summary Error:", err);
    res.status(500).json({ message: "Server error calculating finances" });
  }
};