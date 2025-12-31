const WeeklyPayment = require("../models/WeeklyPayment");
const PujaContribution = require("../models/PujaContribution");
const Donation = require("../models/Donation");
const Expense = require("../models/Expense");
const PujaCycle = require("../models/PujaCycle");

/* ================= SUMMARY (WITH CARRY FORWARD) ================= */
exports.yearSummary = async (req, res) => {
  try {
    const year = Number(req.params.year);

    const yearStart = new Date(`${year}-01-01`);
    const yearEnd = new Date(`${year}-12-31T23:59:59`);

    /* ===== OPENING BALANCE ===== */
    const prevWeekly = await WeeklyPayment.aggregate([
      { $unwind: "$weeks" },
      {
        $match: {
          "weeks.paid": true,
          "weeks.paidAt": { $lt: yearStart },
        },
      },
      {
        $lookup: {
          from: "pujacycles",
          localField: "cycle",
          foreignField: "_id",
          as: "cycle",
        },
      },
      { $unwind: "$cycle" },

      // 🔥 ADD THIS
      {
        $project: {
          amount: { $toDouble: "$cycle.weeklyAmount" },
        },
      },

      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);


    const prevPuja = await PujaContribution.aggregate([
      { $match: { createdAt: { $lt: yearStart } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const prevDonations = await Donation.aggregate([
      { $match: { createdAt: { $lt: yearStart } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const prevExpenses = await Expense.aggregate([
      {
        $match: {
          status: "approved",
          createdAt: { $lt: yearStart },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const openingBalance =
      (prevWeekly[0]?.total || 0) +
      (prevPuja[0]?.total || 0) +
      (prevDonations[0]?.total || 0) -
      (prevExpenses[0]?.total || 0);

    /* ===== CURRENT YEAR ===== */
    const weeklyTotal = await WeeklyPayment.aggregate([
      { $unwind: "$weeks" },
      {
        $match: {
          "weeks.paid": true,
          "weeks.paidAt": { $gte: yearStart, $lte: yearEnd },
        },
      },
      {
        $lookup: {
          from: "pujacycles",
          localField: "cycle",
          foreignField: "_id",
          as: "cycle",
        },
      },
      { $unwind: "$cycle" },

      // 🔥 SAME FIX
      {
        $project: {
          amount: { $toDouble: "$cycle.weeklyAmount" },
        },
      },

      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const pujaTotal = await PujaContribution.aggregate([
      { $match: { createdAt: { $gte: yearStart, $lte: yearEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const donationTotal = await Donation.aggregate([
      { $match: { createdAt: { $gte: yearStart, $lte: yearEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const expenseTotal = await Expense.aggregate([
      {
        $match: {
          status: "approved",
          createdAt: { $gte: yearStart, $lte: yearEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const collections =
      (weeklyTotal[0]?.total || 0) +
      (pujaTotal[0]?.total || 0) +
      (donationTotal[0]?.total || 0);

    const expenses = expenseTotal[0]?.total || 0;

    res.json({
      success: true,
      data: {
        openingBalance,
        collections,
        expenses,
        closingBalance: openingBalance + collections - expenses,
      },
    });
  } catch (err) {
    console.error("History summary error:", err);
    res.status(500).json({ message: "History summary failed" });
  }
};

/* ================= WEEKLY (PER MEMBER TOTAL) ================= */
exports.weekly = async (req, res) => {
  const year = Number(req.params.year);

  const start = new Date(`${year}-01-01`);
  const end = new Date(`${year}-12-31T23:59:59`);

  const rows = await WeeklyPayment.aggregate([
    { $unwind: "$weeks" },
    {
      $match: {
        "weeks.paid": true,
        "weeks.paidAt": { $gte: start, $lte: end },
      },
    },
    {
      $lookup: {
        from: "pujacycles",
        localField: "cycle",
        foreignField: "_id",
        as: "cycle",
      },
    },
    { $unwind: "$cycle" },
    {
      $lookup: {
        from: "users",
        localField: "member",
        foreignField: "_id",
        as: "member",
      },
    },
    { $unwind: "$member" },
    {
      $group: {
        _id: "$member._id",
        memberName: { $first: "$member.name" },
        total: { $sum: "$cycle.weeklyAmount" },
      },
    },
    { $sort: { memberName: 1 } },
  ]);

  res.json({ success: true, data: rows });
};

/* ================= PUJA (PER MEMBER TOTAL) ================= */
exports.puja = async (req, res) => {
  const year = Number(req.params.year);

  const start = new Date(`${year}-01-01`);
  const end = new Date(`${year}-12-31T23:59:59`);

  const rows = await PujaContribution.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "member",
        foreignField: "_id",
        as: "member",
      },
    },
    { $unwind: "$member" },
    {
      $group: {
        _id: "$member._id",
        memberName: { $first: "$member.name" },
        total: { $sum: "$amount" },
      },
    },
    { $sort: { memberName: 1 } },
  ]);

  res.json({ success: true, data: rows });
};

/* ================= DONATIONS ================= */
exports.donations = async (req, res) => {
  const year = Number(req.params.year);

  const rows = await Donation.find({
    createdAt: {
      $gte: new Date(`${year}-01-01`),
      $lte: new Date(`${year}-12-31`),
    },
  });

  res.json({
    success: true,
    data: rows.map((r) => ({
      donorName: r.donorName,
      amount: r.amount,
      date: r.createdAt.toISOString().slice(0, 10),
    })),
  });
};

/* ================= EXPENSES ================= */
exports.expenses = async (req, res) => {
  const year = Number(req.params.year);

  const rows = await Expense.find({
    status: "approved",
    createdAt: {
      $gte: new Date(`${year}-01-01`),
      $lte: new Date(`${year}-12-31`),
    },
  });

  res.json({
    success: true,
    data: rows.map((r) => ({
      title: r.title,
      amount: r.amount,
      date: r.createdAt.toISOString().slice(0, 10),
    })),
  });
};
