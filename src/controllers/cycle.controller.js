const PujaCycle = require("../models/PujaCycle");

/**
 * ================================
 * CREATE NEW PUJA CYCLE (ADMIN)
 * ================================
 * - Auto-calculates endDate
 * - Deactivates previous active cycle
 */
exports.create = async (req, res) => {
  try {
    const {
      name,
      year,
      startDate,
      totalWeeks,
      weeklyAmount,
    } = req.body;

    // --------- VALIDATION ----------
    if (
      !name ||
      !year ||
      !startDate ||
      !totalWeeks ||
      !weeklyAmount
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // --------- DATE CALCULATION ----------
    const start = new Date(startDate);
    if (isNaN(start)) {
      return res.status(400).json({
        message: "Invalid startDate",
      });
    }

    // endDate = startDate + (totalWeeks * 7 days)
    const endDate = new Date(start);
    endDate.setDate(start.getDate() + totalWeeks * 7);

    // --------- DEACTIVATE OLD CYCLES ----------
    await PujaCycle.updateMany(
      { isActive: true },
      { isActive: false }
    );

    // --------- CREATE CYCLE ----------
    const cycle = await PujaCycle.create({
      name,
      year,
      startDate: start,
      endDate,
      totalWeeks,
      weeklyAmount,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      data: cycle,
    });
  } catch (err) {
    console.error("Create cycle error:", err);
    res.status(500).json({
      message: "Failed to create cycle",
    });
  }
};

/**
 * ================================
 * GET ACTIVE PUJA CYCLE
 * ================================
 * - Used by frontend MemberDetails
 */
exports.getActive = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({
      isActive: true,
    });

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
    res.status(500).json({
      message: "Failed to fetch active cycle",
    });
  }
};

/**
 * ================================
 * LIST ALL CYCLES (ADMIN)
 * ================================
 * - Used for history page
 */
exports.list = async (req, res) => {
  try {
    const cycles = await PujaCycle.find().sort({
      year: -1,
    });

    res.json({
      success: true,
      data: cycles,
    });
  } catch (err) {
    console.error("List cycles error:", err);
    res.status(500).json({
      message: "Failed to list cycles",
    });
  }
};
