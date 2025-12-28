const Donation = require('../models/Donation');

exports.list = async (req, res) => {
  const donations = await Donation.find().lean().exec();
  res.json({ donations });
};

exports.create = async (req, res) => {
  try {
    const d = await Donation.create(req.body);
    res.status(201).json({ donation: d });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
