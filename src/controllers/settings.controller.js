const PujaCycle = require("../models/PujaCycle");
const cycleCloseHelper = require("./cycle.controller").closeCycleHelper;

/* ================= GET SETTINGS ================= */
exports.get = async (req, res) => {
  const cycle = await PujaCycle.findOne({ isActive: true });

  res.json({
    success: true,
    data: cycle || null,
  });
};

/* ================= UPDATE SETTINGS ================= */
exports.update = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) return res.status(404).json({ message: "No active cycle" });

    if (cycle.isClosed) {
      return res
        .status(403)
        .json({ message: "Cycle is closed. Cannot edit settings." });
    }

    const {
      name,
      startDate,
      endDate,
      totalWeeks,
      weeklyAmount,
    } = req.body;

    cycle.name = name;
    cycle.startDate = startDate;
    cycle.endDate = endDate;
    cycle.totalWeeks = Number(totalWeeks);
    cycle.weeklyAmount = Number(weeklyAmount);

    await cycle.save();

    res.json({ success: true });
  } catch (err) {
    console.error("Settings update error:", err);
    res.status(500).json({ message: "Failed to update settings" });
  }
};

/* ================= CLOSE YEAR ================= */
exports.closeYear = async (req, res) => {
  await cycleCloseHelper(req, res);
};
