const PujaCycle = require("../models/PujaCycle");

/* ================= CREATE NEW CYCLE ================= */
exports.create = async (req, res) => {
  try {
    const { name, startDate, endDate } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({
        message: "name, startDate and endDate are required",
      });
    }

    await PujaCycle.updateMany(
      { isActive: true },
      { isActive: false }
    );

    const cycle = await PujaCycle.create({
      name,
      startDate,
      endDate,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      data: cycle,
    });
  } catch (err) {
    console.error("Create cycle error:", err);
    res.status(500).json({ message: "Failed to create cycle" });
  }
};

/* ================= GET ACTIVE CYCLE ================= */
exports.getActive = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });

    if (!cycle) {
      return res.status(404).json({
        message: "No active puja cycle found",
      });
    }

    res.json({
      success: true,
      data: cycle,
    });
  } catch (err) {
    console.error("Get active cycle error:", err);
    res.status(500).json({ message: "Failed to fetch active cycle" });
  }
};

/* ================= LIST ALL CYCLES (ADMIN) ================= */
exports.list = async (req, res) => {
  try {
    const cycles = await PujaCycle.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: cycles,
    });
  } catch (err) {
    console.error("List cycles error:", err);
    res.status(500).json({ message: "Failed to list cycles" });
  }
};
