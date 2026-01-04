const FestivalYear = require("../models/FestivalYear");
const calculateBalance = require("../utils/calculateBalance"); 
const Subscription = require("../models/Subscription");

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
       // ... (Balance Logic remains same) ...
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
      
      // ✅ Use the calculated value
      totalInstallments: finalInstallments,
      
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
  // ❌ REMOVED: const session = await FestivalYear.startSession();
  // ❌ REMOVED: session.startTransaction();

  try {
    const { id } = req.params;
    const { clubId } = req.user;
    const { 
      name, startDate, endDate, 
      subscriptionFrequency, totalInstallments, amountPerInstallment 
    } = req.body;

    // 1. Fetch Year (No Session)
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

    await yearDoc.save(); // ❌ REMOVED: { session }

    res.json({ success: true, data: yearDoc, message: "Settings updated successfully." });

  } catch (err) {
    console.error("Update Year Error:", err);
    res.status(400).json({ message: err.message });
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
        
        await sub.save(); // ❌ REMOVED: { session }
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
/**
 * 🛠 HELPER: Adjusts Subscriptions intelligently
 * - Handles Appending (Extension)
 * - Handles Truncating (Reduction)
 * - Handles Amount Updates
 */
async function adjustSubscriptions({ yearId, newFreq, newTotal, newAmount, session }) {
    
    const subs = await Subscription.find({ year: yearId }).session(session);
    if (subs.length === 0) return;

    console.log(`🔄 Adjusting ${subs.length} subs: Freq=${newFreq}, Total=${newTotal}, Amt=${newAmount}`);

    for (const sub of subs) {
        let installments = sub.installments;

        // CASE 1: Frequency Changed (Only possible if NO PAYMENTS existed)
        // We can safely wipe and regenerate
        // (Or if newFreq is 'none', we wipe)
        if (newFreq === 'none') {
            installments = [];
        } 
        else if (installments.length === 0 && newFreq !== 'none') {
            // Was 'none', now 'weekly/monthly' -> Generate fresh
            installments = generateInstallments(newTotal, newAmount);
        }
        else {
            // CASE 2: Duration Change (Weekly -> Weekly)
            
            // A. EXTEND (52 -> 60)
            if (newTotal > installments.length) {
                const startNum = installments.length + 1;
                const addedCount = newTotal - installments.length;
                const newItems = generateInstallments(addedCount, newAmount, startNum);
                installments = [...installments, ...newItems];
            }
            // B. REDUCE (52 -> 40) - We already validated safety above
            else if (newTotal < installments.length) {
                installments = installments.slice(0, newTotal);
            }

            // C. UPDATE AMOUNTS
            // Update expected amount for ALL installments to match new rate
            // (Standard SaaS logic: if price changes, it reflects on grid)
            installments = installments.map(inst => ({
                ...inst,
                amountExpected: newAmount
            }));
        }

        // Recalculate Totals
        // totalPaid is sum of isPaid items (amountExpected might have changed, 
        // but usually we trust the transaction log. For simple logic, we sum the NEW amountExpected of paid items)
        // actually, keeping original payment value is complex without a transaction ledger. 
        // For this system, we assume: Paid is Paid. 
        
        const totalPaid = installments.filter(i => i.isPaid).reduce((sum, i) => sum + i.amountExpected, 0);
        const totalDue = installments.filter(i => !i.isPaid).reduce((sum, i) => sum + i.amountExpected, 0);

        sub.installments = installments;
        sub.totalPaid = totalPaid; 
        sub.totalDue = totalDue;
        
        await sub.save({ session });
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
/**
 * 🛠 HELPER: Migrates all subscriptions for a year to the new structure
 * Preserves the 'totalPaid' amount and re-allocates it to new slots.
 */
async function migrateSubscriptions(yearDoc, session) {
    const { _id, subscriptionFrequency, totalInstallments, amountPerInstallment } = yearDoc;

    // 1. Fetch all subscriptions for this year
    const subs = await Subscription.find({ year: _id }).session(session);

    if (subs.length === 0) return; // No data to migrate

    console.log(`🔄 Migrating ${subs.length} subscriptions to ${subscriptionFrequency} structure...`);

    // 2. Iterate and Re-structure
    for (const sub of subs) {
        const creditAvailable = sub.totalPaid; // 💰 The specific amount they actually paid previously
        
        // A. Generate New Empty Structure
        let newInstallments = [];
        if (subscriptionFrequency !== 'none') {
            for (let i = 1; i <= totalInstallments; i++) {
                newInstallments.push({
                    number: i,
                    amountExpected: amountPerInstallment,
                    isPaid: false,
                    paidDate: null,
                    collectedBy: null
                });
            }
        }

        // B. Re-apply Payments (The "Wallet" Logic)
        let remainingCredit = creditAvailable;
        let newTotalDue = 0;

        newInstallments = newInstallments.map((inst) => {
            // If we have enough credit to cover this installment fully
            if (remainingCredit >= inst.amountExpected) {
                remainingCredit -= inst.amountExpected;
                return { 
                    ...inst, 
                    isPaid: true, 
                    paidDate: new Date() // Timestamp of migration
                };
            }
            // Else, it's unpaid (or partially paid, but schema assumes boolean)
            // We calculate Due based on unpaid items
            newTotalDue += inst.amountExpected;
            return inst;
        });

        // C. Update Subscription Record
        sub.installments = newInstallments;
        // totalPaid remains exactly what it was (we don't lose money)
        // totalDue is recalculated based on the new structure
        sub.totalDue = newTotalDue; 

        await sub.save({ session });
    }
}
  
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