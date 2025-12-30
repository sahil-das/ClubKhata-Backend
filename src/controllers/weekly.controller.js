const WeeklyContribution = require("../models/WeeklyContribution");
const PujaCycle = require("../models/PujaCycle");

/* ================= PAY WEEKLY CONTRIBUTION ================= */
exports.pay = async (req, res) => {
  const { userId, cycleId, weeks } = req.body;

  if (!userId || !cycleId || !weeks || weeks.length === 0) {
    return res.status(400).json({
      message: "Missing required data",
    });
  }

  const cycle = await PujaCycle.findById(cycleId);
  if (!cycle || !cycle.isActive) {
    return res.status(400).json({
      message: "Invalid or inactive Puja cycle",
    });
  }

  // Validate week numbers
  const invalidWeek = weeks.find(
    (w) => w < 1 || w > cycle.totalWeeks
  );
  if (invalidWeek) {
    return res.status(400).json({
      message: "Invalid week number",
    });
  }

  const totalAmount = weeks.length * cycle.weeklyAmount;

  const contribution = await WeeklyContribution.create({
    user: userId,
    cycle: cycleId,
    weeks: weeks.map((w) => ({ weekNumber: w })),
    totalAmount,
    createdBy: req.user.id,
  });

  res.json({
    success: true,
    data: contribution,
  });
};

/* ================= UNDO WEEKLY PAYMENT ================= */
exports.undo = async (req, res) => {
  const contribution = await WeeklyContribution.findById(
    req.params.id
  );

  if (!contribution || !contribution.isActive) {
    return res.status(404).json({
      message: "Contribution not found",
    });
  }

  contribution.isActive = false;
  await contribution.save();

  res.json({
    success: true,
    message: "Weekly contribution undone",
  });
};

/* ================= MEMBER WEEKLY STATUS ================= */
exports.memberStatus = async (req, res) => {
  const { userId } = req.params;

  const cycle = await PujaCycle.findOne({ isActive: true });
  if (!cycle) {
    return res.status(404).json({
      message: "No active Puja cycle",
    });
  }

  const records = await WeeklyContribution.find({
    user: userId,
    cycle: cycle._id,
    isActive: true,
  });

  const paidWeeks = records.flatMap((r) =>
    r.weeks.map((w) => w.weekNumber)
  );

  res.json({
    success: true,
    data: {
      cycle: cycle.name,
      totalWeeks: cycle.totalWeeks,
      weeklyAmount: cycle.weeklyAmount,
      paidWeeks,
      remainingWeeks:
        cycle.totalWeeks - paidWeeks.length,
    },
  });
};
