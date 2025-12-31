const mongoose = require("mongoose");

const pujaContributionSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    cycle: {                      // ✅ THIS IS REQUIRED
      type: mongoose.Schema.Types.ObjectId,
      ref: "PujaCycle",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "PujaContribution",
  pujaContributionSchema
);
