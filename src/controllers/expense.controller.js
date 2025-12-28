const Expense = require('../models/Expense');

exports.list = async (req, res) => {
  const expenses = await Expense.find().lean().exec();
  res.json({ expenses });
};

exports.create = async (req, res) => {
  try {
    const e = await Expense.create(req.body);
    res.status(201).json({ expense: e });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
