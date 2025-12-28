const User = require('../models/User');

exports.register = async (req, res) => {
  // stub: create user
  try {
    const { name, email, password } = req.body;
    const u = await User.create({ name, email, password });
    res.status(201).json({ user: u });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  // stub: return user by email
  const { email } = req.body;
  const user = await User.findOne({ email }).lean().exec();
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  res.json({ user });
};
