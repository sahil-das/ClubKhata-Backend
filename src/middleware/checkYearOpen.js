const PujaCycle = require("../models/PujaCycle");

module.exports = async (req, res, next) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });

    if (!cycle) {
      return res.status(400).json({
        message: "No active Puja cycle. Action not allowed.",
      });
    }

    next();
  } catch (err) {
    console.error("checkYearOpen error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
