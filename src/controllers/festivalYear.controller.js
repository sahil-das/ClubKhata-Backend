const FestivalYear = require("../models/FestivalYear");
const calculateBalance = require("../utils/calculateBalance"); 
const Subscription = require("../models/Subscription");
const { logAction } = require("../utils/auditLogger"); // 👈 IMPORT LOGGER

/**
 * @desc Start a New Festival Year
 * @route POST /api/v1/festival-years
 */
exports.createYear = async (req, res) => {
  try {
    const { 
      name, startDate, endDate, openingBalance, 
      subscriptionFrequency, totalInstallments, amountPerInstallment 
    } = req.body;
    
    const { clubId, id: userId } = req.user;

    // Validate Frequency
    const VALID_FREQUENCIES = ["weekly", "monthly", "none"];
    const frequency = subscriptionFrequency || "weekly";
    if (!VALID_FREQUENCIES.includes(frequency)) return res.status(400).json({ message: "Invalid frequency." });

    // ✅ LOGIC: Determine Total Installments based on Frequency
    let finalInstallments = 0;
    
    if (frequency === "monthly") {
        finalInstallments = 12; // Force 12 for monthly
    } else if (frequency === "weekly") {
        finalInstallments = Number(totalInstallments) || 52; // Default 52 for weekly
    } else {
        finalInstallments = 0; // None
    }

    // 1. FIND LAST YEAR (Active or Closed)
    const lastYear = await FestivalYear.findOne({ club: clubId }).sort({ createdAt: -1 });

    let derivedBalance = 0;

    if (lastYear) {
       if (lastYear.isClosed) {
          derivedBalance = lastYear.closingBalance;
       } else {
          derivedBalance = await calculateBalance(lastYear._id, lastYear.openingBalance);
          // Auto-close previous year
          lastYear.isActive = false;
          lastYear.isClosed = true;
          lastYear.closingBalance = derivedBalance; 
          await lastYear.save();
       }
    }

    // 2. Determine Opening Balance
    let finalOpeningBalance = derivedBalance;
    if (openingBalance !== undefined && openingBalance !== "" && openingBalance !== null) {
        const inputVal = Number(openingBalance);
        if (inputVal !== 0 || derivedBalance === 0) {
            finalOpeningBalance = inputVal;
        }
    }

    // 3. Create New Year
    const newYear = await FestivalYear.create({
      club: clubId,
      name,
      startDate,
      endDate,
      openingBalance: finalOpeningBalance,
      subscriptionFrequency: frequency,
      totalInstallments: finalInstallments,
      amountPerInstallment: frequency === 'none' ? 0 : (Number(amountPerInstallment) || 0),
      isActive: true,
      isClosed: false,
      createdBy: userId
    });

    // ✅ LOG: YEAR STARTED
    await logAction({
      req,
      action: "YEAR_STARTED",
      target: `New Cycle: ${name}`,
      details: { 
        openingBalance: finalOpeningBalance, 
        frequency: frequency,
        totalWeeks: finalInstallments // ✅ Log initial weeks
      }
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

/**
 * @desc Get All Years
 */
exports.getAllYears = async (req, res) => {
    try {
      const years = await FestivalYear.find({ club: req.user.clubId }).sort({ startDate: -1 });
      res.json({ success: true, data: years });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
};

/**
 * @desc Get Currently Active Year
 */
exports.getActiveYear = async (req, res) => {
    try {
      const activeYear = await FestivalYear.findOne({ club: req.user.clubId, isActive: true });
      if (!activeYear) return res.status(404).json({ message: "No active year found." });
      res.json({ success: true, data: activeYear });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
};

/**
 * @desc Update Year Settings
 */
exports.updateYear = async (req, res) => {
  try {
    const { id } = req.params;
    const { clubId } = req.user;
    const { 
      name, startDate, endDate, 
      subscriptionFrequency, totalInstallments, amountPerInstallment 
    } = req.body;

    // 1. Fetch Year
    const yearDoc = await FestivalYear.findOne({ _id: id, club: clubId });
    if (!yearDoc) throw new Error("Year not found");

    // 2. Detect Changes
    const newFreq = subscriptionFrequency || yearDoc.subscriptionFrequency;
    const newTotal = Number(totalInstallments) || yearDoc.totalInstallments;
    const newAmount = Number(amountPerInstallment) !== undefined ? Number(amountPerInstallment) : yearDoc.amountPerInstallment;

    const freqChanged = newFreq !== yearDoc.subscriptionFrequency;
    const durationChanged = newTotal !== yearDoc.totalInstallments;
    const amountChanged = newAmount !== yearDoc.amountPerInstallment;

    // 3. Check for Existing Payments
    const subsWithPayments = await Subscription.countDocuments({
        year: id,
        "installments.isPaid": true
    });

    const hasPayments = subsWithPayments > 0;

    // --- VALIDATION LOGIC ---

    // A. FREQUENCY CHANGE
    if (freqChanged && hasPayments) {
        throw new Error(`Cannot change Frequency (to ${newFreq}) because payments have already been collected. Delete all payments first.`);
    }

    // B. DURATION DECREASE (e.g., 52 -> 40 weeks)
    if (durationChanged && newTotal < yearDoc.totalInstallments) {
        // Check if anyone paid for a week that is about to be deleted
        const conflict = await Subscription.findOne({
            year: id,
            installments: {
                $elemMatch: {
                    number: { $gt: newTotal }, // Week > 40
                    isPaid: true
                }
            }
        });

        if (conflict) {
            throw new Error(`Cannot reduce to ${newTotal} weeks. Installment #${conflict.installments.find(i=>i.isPaid && i.number > newTotal).number} is already paid.`);
        }
    }

    // 4. Update Year Doc
    if (name) yearDoc.name = name;
    if (startDate) yearDoc.startDate = startDate;
    if (endDate) yearDoc.endDate = endDate;
    yearDoc.subscriptionFrequency = newFreq;
    yearDoc.totalInstallments = newTotal;
    yearDoc.amountPerInstallment = newAmount;

    // 5. Trigger Subscription Updates (No Session)
    if (freqChanged || durationChanged || amountChanged) {
        await adjustSubscriptions({
            yearId: id,
            newFreq,
            newTotal,
            newAmount
        });
    }

    await yearDoc.save();

    // ✅ LOG: YEAR SETTINGS UPDATED (Now includes Total Weeks)
    await logAction({
      req,
      action: "YEAR_UPDATED",
      target: `Settings: ${yearDoc.name}`,
      details: { 
        amount: newAmount,
        frequency: newFreq,
        totalWeeks: newTotal // 👈 ADDED HERE
      }
    });

    res.json({ success: true, data: yearDoc, message: "Settings updated successfully." });

  } catch (err) {
    console.error("Update Year Error:", err);
    res.status(400).json({ message: err.message });
  }
};

/**
 * @desc Close Year Permanently
 */
exports.closeYear = async (req, res) => {
  try {
    const { id } = req.params;
    const { clubId } = req.user;

    // 1. Find the year
    const year = await FestivalYear.findOne({ _id: id, club: clubId });
    if (!year) return res.status(404).json({ message: "Year not found" });

    // 2. Calculate Final Balance one last time
    const finalBalance = await calculateBalance(year._id, year.openingBalance);

    // 3. Save updates
    year.isActive = false;
    year.isClosed = true;
    year.closingBalance = finalBalance; // ✅ STORED PERMANENTLY
    
    await year.save();

    // ✅ LOG: YEAR CLOSED
    await logAction({
      req,
      action: "YEAR_CLOSED",
      target: `Closed Cycle: ${year.name}`,
      details: { finalBalance: finalBalance }
    });

    res.json({ 
      success: true, 
      message: `Year '${year.name}' closed. Final Balance: ₹${finalBalance} saved.`,
      data: year
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * 🛠 HELPER: Adjusts Subscriptions (No Session Version)
 */
async function adjustSubscriptions({ yearId, newFreq, newTotal, newAmount }) {
    
    const subs = await Subscription.find({ year: yearId });
    if (subs.length === 0) return;

    console.log(`🔄 Adjusting ${subs.length} subs: Freq=${newFreq}, Total=${newTotal}, Amt=${newAmount}`);

    for (const sub of subs) {
        let installments = sub.installments;

        // CASE 1: Frequency Changed (Only possible if NO PAYMENTS existed)
        if (newFreq === 'none') {
            installments = [];
        } 
        else if (installments.length === 0 && newFreq !== 'none') {
            installments = generateInstallments(newTotal, newAmount);
        }
        else {
            // CASE 2: Duration Change
            
            // A. EXTEND (52 -> 60)
            if (newTotal > installments.length) {
                const startNum = installments.length + 1;
                const addedCount = newTotal - installments.length;
                const newItems = generateInstallments(addedCount, newAmount, startNum);
                installments = [...installments, ...newItems];
            }
            // B. REDUCE (52 -> 40) - Validated above
            else if (newTotal < installments.length) {
                installments = installments.slice(0, newTotal);
            }

            // C. UPDATE AMOUNTS
            installments = installments.map(inst => ({
                ...inst,
                amountExpected: newAmount
            }));
        }

        // Recalculate Totals
        const totalPaid = installments.filter(i => i.isPaid).reduce((sum, i) => sum + i.amountExpected, 0);
        const totalDue = installments.filter(i => !i.isPaid).reduce((sum, i) => sum + i.amountExpected, 0);

        sub.installments = installments;
        sub.totalPaid = totalPaid; 
        sub.totalDue = totalDue;
        
        await sub.save();
    }
}

function generateInstallments(count, amount, startNumber = 1) {
    const arr = [];
    for (let i = 0; i < count; i++) {
        arr.push({
            number: startNumber + i,
            amountExpected: amount,
            isPaid: false,
            paidDate: null,
            collectedBy: null
        });
    }
    return arr;
}