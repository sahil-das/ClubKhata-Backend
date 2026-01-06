const mongoose = require("mongoose");
const mongooseMoney = require("../utils/mongooseMoney"); // 👈 IMPORT

const subscriptionSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  member: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
  
  installments: [{
    number: Number,
    
    // 💰 FIX: Use mongooseMoney
    amountExpected: mongooseMoney, 
    
    isPaid: { type: Boolean, default: false },
    paidDate: Date,
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }],

  // 💰 FIX: Use mongooseMoney
  totalPaid: { ...mongooseMoney, default: 0 },
  totalDue: { ...mongooseMoney, default: 0 }
}, { timestamps: true });

subscriptionSchema.index({ year: 1, member: 1 }, { unique: true });

module.exports = mongoose.model("Subscription", subscriptionSchema);