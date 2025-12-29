const Donation = require("../models/Donation");

exports.list = async (req, res) => {
  try {
    const { year } = req.query;

    const donations = await Donation.find({ year }).sort({ date: -1 });

    // normalize old records
    const normalized = donations.map(d => ({
      ...d.toObject(),
      name: d.name || "Anonymous",
    }));

    res.json({
      success: true,
      donations: normalized,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, amount, date, year } = req.body;

    await Donation.create({
      name: name?.trim() || "Anonymous", // ✅ optional
      amount,
      date,
      year,
    });

    res.json({
      success: true,
      message: "Donation added",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
