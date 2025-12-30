const mongoose = require("mongoose");

const weeklyContributionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  cycle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PujaCycle",
    required: true,
  },

  weeks: [
    {
      weekNumber: Number,
      paidAt: Date,
    },
  ],

  totalAmount: Number,

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // admin
  },

  isActive: {
    type: Boolean,
    default: true, // undo support
  },
}, { timestamps: true });

module.exports = mongoose.model(
  "WeeklyContribution",
  weeklyContributionSchema
);
