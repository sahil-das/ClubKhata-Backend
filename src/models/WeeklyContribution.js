const mongoose = require("mongoose");

const weeklyContributionSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    cycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PujaCycle",
      required: true,
    },

    weekNumber: {
      type: Number,
      required: true,
    },

    paid: {
      type: Boolean,
      default: false,
    },

    paidAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "WeeklyContribution",
  weeklyContributionSchema
);
