const mongoose = require("mongoose");
const mongooseMoney = require("../utils/mongooseMoney"); // 👈 IMPORT

const festivalYearSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  name: { type: String, required: true }, 
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  subscriptionFrequency: { 
    type: String, 
    enum: ["weekly", "monthly", "none"],
    required: true 
  },
  totalInstallments: { type: Number, default: 52 }, 
  
  // 💰 FIX: Use mongooseMoney
  amountPerInstallment: { ...mongooseMoney, default: 0 },
  openingBalance: { ...mongooseMoney, default: 0 },
  closingBalance: { ...mongooseMoney, default: 0 },
  
  isActive: { type: Boolean, default: false },
  isClosed: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

module.exports = mongoose.model("FestivalYear", festivalYearSchema);