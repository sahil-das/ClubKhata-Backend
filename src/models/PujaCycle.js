// src/models/PujaCycle.js
const mongoose = require("mongoose");

const pujaCycleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    startDate: Date,
    endDate: Date,
    totalWeeks: Number,
    weeklyAmount: Number,

    isActive: { type: Boolean, default: false },
    isClosed: { type: Boolean, default: false }, // 🔥 IMPORTANT

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PujaCycle", pujaCycleSchema);
