const User = require("../models/User");
const bcrypt = require("bcryptjs");

/**
 * GET all members (admin only)
 */
exports.list = async (req, res) => {
  const members = await User.find({ role: "member" }).select("-password");
  res.json({
    success: true,
    data: members,
  });
};

/**
 * CREATE member (admin only)
 */
exports.create = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    /* ================= VALIDATION ================= */
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    // ✅ Force domain
    if (!email.endsWith("@clubname.com")) {
      return res.status(400).json({
        message: "Email must be @clubname.com",
      });
    }

    // ✅ Unique email
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    /* ================= PASSWORD ================= */
    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    /* ================= CREATE ================= */
    const member = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      role: "member", // 🔒 forced
    });

    res.status(201).json({
      success: true,
      message: "Member created successfully",
      data: {
        id: member._id,
        name: member.name,
        email: member.email,
      },
    });
  } catch (err) {
    console.error("Member create error:", err);
    res.status(500).json({
      message: "Server error",
    });
  }
};

/**
 * GET member details
 */
exports.details = async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");

  if (!user) {
    return res.status(404).json({
      message: "Member not found",
    });
  }

  res.json({
    success: true,
    data: user,
  });
};
