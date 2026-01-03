const FestivalYear = require("../models/FestivalYear");
const calculateBalance = require("../utils/calculateBalance"); 

exports.createYear = async (req, res) => {
  try {
    const { 
      name, startDate, endDate, openingBalance, 
      subscriptionFrequency, totalInstallments, amountPerInstallment 
    } = req.body;
    
    const { clubId, id: userId } = req.user;

    // 1. Validate Frequency
    const VALID_FREQUENCIES = ["weekly", "monthly", "none"];
    const frequency = subscriptionFrequency || "weekly";
    if (!VALID_FREQUENCIES.includes(frequency)) {
      return res.status(400).json({ message: "Invalid frequency." });
    }

    // 2. FIND PREVIOUS YEAR (Active or Closed)
    const lastYear = await FestivalYear.findOne({ club: clubId })
                                       .sort({ createdAt: -1 });

    let derivedBalance = 0;
    
    if (lastYear) {
       console.log(`📅 Found previous year: "${lastYear.name}"`);
       derivedBalance = await calculateBalance(lastYear._id, lastYear.openingBalance);
       console.log(`✅ Calculated Carry Forward: ₹${derivedBalance}`);

       // Close old year if active
       if (lastYear.isActive) {
         lastYear.isActive = false;
         await lastYear.save();
       }
    }

    // 3. INTELLIGENT OPENING BALANCE LOGIC
    // Logic:
    // - If user sends explicit number (e.g., 5000), use it.
    // - If user sends 0, but we have a derived balance, prefer derived balance (Safe default).
    // - If user sends "", null, or undefined, use derived balance.
    // - If user REALLY wants 0 despite having previous money, they can edit it later in settings.
    
    let finalOpeningBalance = derivedBalance; // Default to carry forward

    if (openingBalance !== undefined && openingBalance !== "" && openingBalance !== null) {
        const inputVal = Number(openingBalance);
        
        // Only override if the input is NOT zero, OR if derived is zero.
        // If input is 0 and derived is > 0, we assume user left it empty/default on frontend.
        if (inputVal !== 0 || derivedBalance === 0) {
            finalOpeningBalance = inputVal;
        }
    }

    console.log(`💰 Final Opening Balance set to: ₹${finalOpeningBalance}`);

    // 4. Create New Year
    const newYear = await FestivalYear.create({
      club: clubId,
      name,
      startDate,
      endDate,
      openingBalance: finalOpeningBalance,
      subscriptionFrequency: frequency,
      totalInstallments: frequency === 'none' ? 0 : (Number(totalInstallments) || 52),
      amountPerInstallment: frequency === 'none' ? 0 : (Number(amountPerInstallment) || 0),
      isActive: true,
      isClosed: false,
      createdBy: userId
    });

    res.status(201).json({
      success: true,
      message: `Cycle '${name}' started. Opening Balance: ₹${finalOpeningBalance}`,
      year: newYear
    });

  } catch (err) {
    console.error("Create Year Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ... (Keep existing exports: getAllYears, getActiveYear, updateYear, closeYear) ...
exports.getAllYears = async (req, res) => {
    try {
      const years = await FestivalYear.find({ club: req.user.clubId }).sort({ startDate: -1 });
      res.json({ success: true, data: years });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
};

exports.getActiveYear = async (req, res) => {
    try {
      const activeYear = await FestivalYear.findOne({ club: req.user.clubId, isActive: true });
      if (!activeYear) return res.status(404).json({ message: "No active year found." });
      res.json({ success: true, data: activeYear });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
};

exports.updateYear = async (req, res) => {
    try {
      const updated = await FestivalYear.findOneAndUpdate(
        { _id: req.params.id, club: req.user.clubId },
        req.body,
        { new: true }
      );
      res.json({ success: true, data: updated });
    } catch (err) { res.status(500).json({ message: "Server Error" }); }
};
  
exports.closeYear = async (req, res) => {
    try {
      const year = await FestivalYear.findOneAndUpdate(
         { _id: req.params.id, club: req.user.clubId },
         { isActive: false, isClosed: true },
         { new: true }
      );
      res.json({ success: true, message: "Year closed." });
    } catch (err) { res.status(500).json({ message: "Server Error" }); }
};