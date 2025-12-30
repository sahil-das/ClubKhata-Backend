const mongoose = require("mongoose");

const weekSchema = new mongoose.Schema(
  {
    week: {
      type: Number,
      required: true,
    },
    paid: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const weeklyPaymentSchema = new mongoose.Schema(
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
    weeks: {
      type: [weekSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "WeeklyPayment",
  weeklyPaymentSchema
);
