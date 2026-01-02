// src/controllers/settings.controller.js
const PujaCycle = require("../models/PujaCycle");
const cycleController = require("./cycle.controller"); // Import the fixed controller
const WeeklyPayment = require("../models/WeeklyPayment"); // ✅ Import this

/* ================= GET SETTINGS ================= */
exports.get = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    res.json({
      success: true,
      data: cycle || null,
    });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

/* ================= UPDATE SETTINGS ================= */
exports.update = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) return res.status(404).json({ message: "No active cycle" });

    if (cycle.isClosed) {
      return res.status(403).json({ message: "Cycle is closed. Cannot edit settings." });
    }

    const { name, startDate, endDate, totalWeeks, weeklyAmount } = req.body;
    
    const oldTotalWeeks = cycle.totalWeeks;
    const newTotalWeeks = Number(totalWeeks);

    /* ---------------------------------------------------------
       🛡️ SAFETY CHECK: PREVENT DELETING PAID WEEKS
       If trying to reduce weeks, ensure no one has paid for them.
       --------------------------------------------------------- */
    if (totalWeeks && newTotalWeeks < oldTotalWeeks) {
      const conflict = await WeeklyPayment.findOne({
        cycle: cycle._id,
        weeks: {
          $elemMatch: {
            week: { $gt: newTotalWeeks }, // Check weeks beyond the new limit
            paid: true                    // That are actually marked as PAID
          }
        }
      });

      if (conflict) {
        return res.status(400).json({
          message: `Cannot reduce total weeks to ${newTotalWeeks}. Some members have already paid for weeks beyond this limit. Please undo those payments first.`
        });
      }
    }

    // --- APPLY UPDATES TO CYCLE ---
    if (name) cycle.name = name;
    if (startDate) cycle.startDate = startDate;
    if (endDate) cycle.endDate = endDate;
    if (weeklyAmount) cycle.weeklyAmount = Number(weeklyAmount);
    if (totalWeeks) cycle.totalWeeks = newTotalWeeks;

    await cycle.save();

    /* ---------------------------------------------------------
       ⚡ SYNC WEEKLY PAYMENTS (If weeks changed)
       --------------------------------------------------------- */
    if (totalWeeks && newTotalWeeks !== oldTotalWeeks) {
      console.log(`Syncing weeks from ${oldTotalWeeks} to ${newTotalWeeks}...`);

      if (newTotalWeeks > oldTotalWeeks) {
        // CASE 1: INCREASE WEEKS (e.g., 50 -> 52)
        const weeksToAdd = [];
        for (let i = oldTotalWeeks + 1; i <= newTotalWeeks; i++) {
          weeksToAdd.push({ week: i, paid: false, paidAt: null });
        }

        await WeeklyPayment.updateMany(
          { cycle: cycle._id },
          { $push: { weeks: { $each: weeksToAdd } } }
        );

      } else {
        // CASE 2: DECREASE WEEKS (e.g., 52 -> 50)
        // We already passed the safety check above, so it is safe to delete.
        
        const payments = await WeeklyPayment.find({ cycle: cycle._id });
        
        const updatePromises = payments.map((p) => {
          if (p.weeks.length > newTotalWeeks) {
            // Trim the array to the new length
            p.weeks = p.weeks.slice(0, newTotalWeeks);
            return p.save();
          }
        });
        
        await Promise.all(updatePromises);
      }
    }

    res.json({ success: true, message: "Settings and Member Records Updated" });
  } catch (err) {
    console.error("Settings update error:", err);
    res.status(500).json({ message: "Failed to update settings" });
  }
};
/* ================= CLOSE YEAR (Wrapper) ================= */
// If the frontend calls /api/settings/close-year, we delegate to cycleController
exports.closeYear = async (req, res) => {
  return cycleController.closeActiveCycle(req, res);
};