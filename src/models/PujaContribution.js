const mongoose = require('mongoose');

const PujaContributionSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  pujaName: { type: String },
  date: { type: Date, default: Date.now },
  year: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialYear' },
});

module.exports = mongoose.model('PujaContribution', PujaContributionSchema);
