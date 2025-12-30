const mongoose = require("mongoose");

const pujaCycleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true, // e.g. Saraswati Puja 2026
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    totalWeeks: {
      type: Number,
      required: true,
    },

    weeklyAmount: {
      type: Number,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PujaCycle", pujaCycleSchema);
