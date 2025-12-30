const mongoose = require("mongoose");

const weeklyConfigSchema = new mongoose.Schema({
  year: { type: Number, required: true, unique: true },
  totalWeeks: { type: Number, required: true },
  amountPerWeek: { type: Number, required: true },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, { timestamps: true });

module.exports = mongoose.model("WeeklyConfig", weeklyConfigSchema);
