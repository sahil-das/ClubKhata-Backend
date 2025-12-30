require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const name = "Admin User"; // ✅ FIXED
    const email = "admin@clubname.com";
    const password = "admin";

    const existing = await User.findOne({ email });
    if (existing) {
      console.log("⚠️ Admin already exists");
      process.exit();
    }

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
      name,              // ✅ SAVED
      email,
      password: hashed,
      role: "admin",
    });

    console.log("✅ Admin user created successfully");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
