const express = require("express");
const router = express.Router();
const { 
  registerClub, 
  login, 
  refreshToken, 
  revokeToken, 
  getMe, 
  updateProfile, 
  changePassword 
} = require("../controllers/auth.controller");
const protect = require("../middleware/auth.middleware");

// Public
router.post("/register", registerClub);
router.post("/login", login);
router.post("/refresh-token", refreshToken); // 🆕

// Protected
router.post("/revoke-token", protect, revokeToken); // 🆕
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.put("/update-password", protect, changePassword);

module.exports = router;