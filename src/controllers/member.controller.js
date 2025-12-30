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
  const { name, email } = req.body;

  // ✅ Validation
  if (!name || !email) {
    return res.status(400).json({
      message: "Name and email are required",
    });
  }

  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(400).json({
      message: "User already exists",
    });
  }

  // 🔐 Auto-generate password (or you can accept input)
  const rawPassword = "member123"; // later you can email this
  const hashed = await bcrypt.hash(rawPassword, 10);

  const member = await User.create({
    name,
    email,
    password: hashed,
    role: "member", // 🔒 force role
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
