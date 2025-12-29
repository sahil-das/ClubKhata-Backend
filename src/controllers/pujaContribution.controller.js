const PujaContribution = require("../models/PujaContribution");
const FinancialYear = require("../models/FinancialYear");

exports.list = async (req, res) => {
  try {
    const { year } = req.query;

    const fy = await FinancialYear.findOne({ year });
    if (!fy) {
      return res.status(404).json({ message: "Financial year not found" });
    }

    const data = await PujaContribution.find({ year: fy._id })
      .populate("member", "email")
      .sort({ paidAt: 1 });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { memberId, amount, year } = req.body;

    const fy = await FinancialYear.findOne({ year });
    if (!fy) {
      return res.status(404).json({ message: "Financial year not found" });
    }

    await PujaContribution.create({
      member: memberId,
      amount,
      year: fy._id,
      paidAt: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
