// controllers/year.controller.js
const FinancialYear = require("../models/FinancialYear");
const calculateBalance = require("../utils/calculateBalance");

exports.closeYear = async (req, res) => {
  const { year } = req.body;

  const fy = await FinancialYear.findOne({ year });
  if (!fy || fy.isClosed)
    return res.status(400).json({ message: "Invalid year" });

  const closingBalance = await calculateBalance(year, fy.openingBalance);

  fy.closingBalance = closingBalance;
  fy.isClosed = true;
  fy.closedAt = new Date();
  await fy.save();

  // Create next year automatically
  await FinancialYear.create({
    year: year + 1,
    openingBalance: closingBalance
  });

  res.json({ message: "Year closed successfully" });
};
