const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  token: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  created: { type: Date, default: Date.now },
  createdByIp: { type: String },
  
  // Security: Revocation & Rotation
  revoked: { type: Date },
  revokedByIp: { type: String },
  replacedByToken: { type: String } // If rotated, point to new token
});

refreshTokenSchema.virtual('isExpired').get(function () {
  return Date.now() >= this.expiresAt;
});

refreshTokenSchema.virtual('isActive').get(function () {
  return !this.revoked && !this.isExpired;
});

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);