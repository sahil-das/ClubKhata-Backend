const PujaContribution = require("../models/PujaContribution");

const User = require("../models/User");     // required for populate

/* ================= LIST ================= */
exports.list = async (req, res) => {
  try {
    const data = await PujaContribution.find()
      .populate("member", "name email")
      .populate("addedBy", "name email")
      .sort({ createdAt: -1 }); // ✅ FIXED

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("Puja list error:", err);
    res.status(500).json({ message: "Failed to load puja contributions" });
  }
};

/* ================= MEMBER TOTAL ================= */
exports.memberTotal = async (req, res) => {
  try {
    const { memberId } = req.params;

    const rows = await PujaContribution.find({
      member: memberId,
    });

    const total = rows.reduce((sum, r) => sum + r.amount, 0);

    res.json({
      success: true,
      total,
      records: rows,
    });
  } catch (err) {
    console.error("Member puja total error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= SUMMARY (ALL MEMBERS) ================= */
exports.summary = async (req, res) => {
  try {
    const rows = await PujaContribution.aggregate([
      {
        $group: {
          _id: "$member",
          total: { $sum: "$amount" },
        },
      },
    ]);

    const result = rows.map((r) => ({
      memberId: r._id,
      total: r.total,
      paid: r.total > 0,
    }));

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Puja summary error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= CREATE ================= */
exports.create = async (req, res) => {
  try {
    // 🔥 FIX: accept memberId (frontend)
    const { memberId, amount } = req.body;

    if (!memberId || !amount) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const contribution = await PujaContribution.create({
      member: memberId,          // ✅ mapped correctly
      amount,
      addedBy: req.user._id,     // from auth middleware
    });

    res.status(201).json({
      success: true,
      data: contribution,
    });
  } catch (err) {
    console.error("Puja contribution error:", err);
    res.status(500).json({ message: "Create failed" });
  }
};
