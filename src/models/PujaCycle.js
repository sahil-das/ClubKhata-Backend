// src/models/PujaCycle.js
const mongoose = require("mongoose");

const pujaCycleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    startDate: Date,
    endDate: Date,
    totalWeeks: {
      type: Number,
      required: true,
      default: 52,
    },

    weeklyAmount: Number,

    openingBalance: {
      type: Number,
      default: 0,
    },

    closingBalance: {
      type: Number,
      default: 0,
    },

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
