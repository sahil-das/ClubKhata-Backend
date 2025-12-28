const User = require('../models/User');

exports.list = async (req, res) => {
  const users = await User.find().lean().exec();
  res.json({ users });
};

exports.get = async (req, res) => {
  const user = await User.findById(req.params.id).lean().exec();
  if (!user) return res.status(404).json({ message: 'Not found' });
  res.json({ user });
};
