// models/Donation.js
const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema({
  donorName: String,
  amount: Number,
  year: Number,
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Donation", donationSchema);
