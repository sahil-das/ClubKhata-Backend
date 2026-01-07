const mongoose = require("mongoose");
const mongooseMoney = require("../utils/mongooseMoney");

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
  
  // These fields are correct
  amountPerInstallment: { ...mongooseMoney, default: 0 },
  openingBalance: { ...mongooseMoney, default: 0 },
  closingBalance: { ...mongooseMoney, default: 0 },
  
  isActive: { type: Boolean, default: false },
  isClosed: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { 
  timestamps: true,
  // 🚨 CRITICAL FIX: Tell Mongoose to run the "paisa-to-rupee" converter when sending API responses
  toJSON: { getters: true }, 
  toObject: { getters: true }
});

module.exports = mongoose.model("FestivalYear", festivalYearSchema);