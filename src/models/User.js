// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true // username@clubname.com
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["admin", "member"],
    default: "member"
  }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
