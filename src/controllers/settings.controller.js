// src/controllers/settings.controller.js
const PujaCycle = require("../models/PujaCycle");

/* ===== GET CURRENT SETTINGS ===== */
exports.getSettings = async (req, res) => {
  const cycle = await PujaCycle.findOne({ isActive: true });

  res.json({
    success: true,
    data: cycle,
  });
};

/* ===== UPDATE SETTINGS (ADMIN) ===== */
exports.updateSettings = async (req, res) => {
  const {
    name,
    startDate,
    endDate,
    totalWeeks,
    weeklyAmount,
  } = req.body;

  const cycle = await PujaCycle.findOne({ isActive: true });
  if (!cycle) {
    return res.status(404).json({ message: "No active year" });
  }

  Object.assign(cycle, {
    name,
    startDate,
    endDate,
    totalWeeks,
    weeklyAmount,
  });

  await cycle.save();

  res.json({ success: true, data: cycle });
};

/* ===== CLOSE YEAR ===== */
exports.closeYear = async (req, res) => {
  const cycle = await PujaCycle.findOne({ isActive: true });

  if (!cycle) {
    return res.status(404).json({ message: "No active year" });
  }

  cycle.isActive = false;
  cycle.isClosed = true;
  await cycle.save();

  res.json({ success: true, message: "Year closed" });
};
