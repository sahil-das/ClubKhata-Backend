const mongoose = require("mongoose");

const pujaCycleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true, // e.g. "Saraswati Puja 2026"
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true, // ✅ this was missing earlier
    },

    isActive: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PujaCycle", pujaCycleSchema);
