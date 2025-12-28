// middleware/yearOpen.middleware.js
const FinancialYear = require("../models/FinancialYear");

module.exports = async (req, res, next) => {
  const year = req.body.year || req.query.year;
  const fy = await FinancialYear.findOne({ year });

  if (!fy || fy.isClosed)
    return res.status(400).json({ message: "Financial year is closed" });

  next();
};
