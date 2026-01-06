const mongoose = require("mongoose");
const mongooseMoney = require("../utils/mongooseMoney"); // 👈 IMPORT

const clubSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, lowercase: true, trim: true },
  address: { type: String, default: "" },
  contactPhone: { type: String, default: "" },
  
  settings: {
    contributionFrequency: {
      type: String,
      enum: ["weekly", "monthly", "none"], 
      default: "weekly"
    },
    defaultInstallmentCount: { type: Number, default: 52 },
    
    // 💰 FIX: Use mongooseMoney
    defaultAmountPerInstallment: { 
      ...mongooseMoney, 
      default: 0 
    },
    
    currency: { type: String, default: "INR" }
  },
  
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Club", clubSchema);