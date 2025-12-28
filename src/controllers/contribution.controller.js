const WeeklyContribution = require('../models/WeeklyContribution');
const PujaContribution = require('../models/PujaContribution');

exports.listWeekly = async (req, res) => {
  const items = await WeeklyContribution.find().lean().exec();
  res.json({ items });
};

exports.listPuja = async (req, res) => {
  const items = await PujaContribution.find().lean().exec();
  res.json({ items });
};
