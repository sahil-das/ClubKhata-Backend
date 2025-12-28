// models/FinancialYear.js
const mongoose = require("mongoose");

const financialYearSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true,
    unique: true
  },
  openingBalance: {
    type: Number,
    required: true
  },
  closingBalance: {
    type: Number
  },
  isClosed: {
    type: Boolean,
    default: false
  },
  closedAt: Date
}, { timestamps: true });

module.exports = mongoose.model("FinancialYear", financialYearSchema);
