const Donation = require("../models/Donation");

/* ===== LIST ===== */
exports.list = async (req, res) => {
  const donations = await Donation.find()
    .populate("addedBy", "name email")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: donations });
};

/* ===== CREATE ===== */
exports.create = async (req, res) => {
  const { donorName, amount } = req.body;

  if (!donorName || !amount) {
    return res.status(400).json({ message: "All fields required" });
  }

  const donation = await Donation.create({
    donorName,
    amount,
    addedBy: req.user._id,
  });

  res.json({ success: true, data: donation });
};
