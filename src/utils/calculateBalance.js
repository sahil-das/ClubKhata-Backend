const mongoose = require("mongoose");
const Subscription = require("../models/Subscription");
const MemberFee = require("../models/MemberFee");
const Donation = require("../models/Donation");
const Expense = require("../models/Expense");

/**
 * Calculates the Net Balance for a specific Year.
 * @param {string} yearId - The FestivalYear ID
 * @param {string|number} openingBalance - Opening Balance in Rupees (e.g. "50.00" or 50)
 * @returns {number} Balance in RUPEES (so Mongoose Setter can convert to Paise)
 */
module.exports = async (yearId, openingBalance = 0) => {
  try {
    // 1. Cast yearId to ObjectId (Aggregations require this)
    const id = new mongoose.Types.ObjectId(yearId);

    // 2. Run Aggregations (These return INTEGER PAISE)
    const [subStats, feeStats, donationStats, expenseStats] = await Promise.all([
        Subscription.aggregate([
            { $match: { year: id } },
            { $group: { _id: null, total: { $sum: "$totalPaid" } } } // Integers
        ]),
        MemberFee.aggregate([
            { $match: { year: id } },
            { $group: { _id: null, total: { $sum: "$amount" } } } // Integers
        ]),
        Donation.aggregate([
            { $match: { year: id } },
            { $group: { _id: null, total: { $sum: "$amount" } } } // Integers
        ]),
        Expense.aggregate([
            { $match: { year: id, status: "approved" } },
            { $group: { _id: null, total: { $sum: "$amount" } } } // Integers
        ])
    ]);

    // 3. Extract Integers (Paise)
    const incomePaise = (subStats[0]?.total || 0) + (feeStats[0]?.total || 0) + (donationStats[0]?.total || 0);
    const expensePaise = expenseStats[0]?.total || 0;

    // 4. Handle Opening Balance (Input is Rupees, need Paise)
    // openingBalance might be "50.00" (String) or 50 (Number).
    // parseFloat parses "50.00" to 50. Multiply by 100 to get 5000 Paise.
    const openingPaise = Math.round(parseFloat(openingBalance || 0) * 100);

    // 5. Calculate Total (All in Paise)
    const totalPaise = openingPaise + incomePaise - expensePaise;

    // 6. Return RUPEES (Float)
    // Why? Because 'year.closingBalance = result' triggers the Mongoose Setter.
    // The Setter does (result * 100). 
    // If we return 5000 (Paise), Setter makes it 500000. We want 5000 in DB.
    // So we return 50.
    const totalRupees = totalPaise / 100;

    console.log(`💰 Balance Calc for Year ${id}:`);
    console.log(`   Open: ${openingPaise}p | Inc: ${incomePaise}p | Exp: ${expensePaise}p`);
    console.log(`   Net: ${totalPaise}p -> Returns: ₹${totalRupees}`);
    
    return totalRupees;

  } catch (err) {
    console.error("Balance Calculation Error:", err);
    return 0;
  }
};