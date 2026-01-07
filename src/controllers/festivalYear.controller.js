const FestivalYear = require("../models/FestivalYear");
const calculateBalance = require("../utils/calculateBalance"); 
const Subscription = require("../models/Subscription");
const { logAction } = require("../utils/auditLogger");
const { toClient } = require("../utils/mongooseMoney"); // 👈 IMPORT THIS

/**
 * 🛠 HELPER: Format Year Object (Int -> String)
 * Ensures frontend gets "200.00" (Rupees) instead of 20000 (Paisa)
 */
const formatYear = (yearDoc) => {
  if (!yearDoc) return null;
  const obj = yearDoc.toObject ? yearDoc.toObject() : yearDoc;
  
  // Safe extraction of raw integer values
  const rawAmount = yearDoc.get ? yearDoc.get('amountPerInstallment', null, { getters: false }) : obj.amountPerInstallment;
  const rawOpening = yearDoc.get ? yearDoc.get('openingBalance', null, { getters: false }) : obj.openingBalance;
  const rawClosing = yearDoc.get ? yearDoc.get('closingBalance', null, { getters: false }) : obj.closingBalance;

  // Overwrite with formatted strings
  obj.amountPerInstallment = toClient(rawAmount || 0);
  obj.openingBalance = toClient(rawOpening || 0);
  obj.closingBalance = toClient(rawClosing || 0);

  return obj;
};

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

    // Determine Total Installments
    let finalInstallments = 0;
    
    if (frequency === "monthly") {
        finalInstallments = 12;
    } else if (frequency === "weekly") {
        finalInstallments = Number(totalInstallments) || 52;
    } else {
        finalInstallments = 0;
    }

    // 1. FIND LAST YEAR
    const lastYear = await FestivalYear.findOne({ club: clubId }).sort({ createdAt: -1 });

    let derivedBalance = 0;

    if (lastYear) {
       if (lastYear.isClosed) {
          derivedBalance = lastYear.get('closingBalance', null, { getters: false }); // Get Raw Integer
       } else {
          // calculateBalance likely returns a formatted string/number. 
          // If it returns raw paisa, use it. If it returns rupees, convert.
          // Assuming calculateBalance returns Rupees or string "500.00":
          const calcBal = await calculateBalance(lastYear._id, lastYear.openingBalance);
          derivedBalance = Number(calcBal) * 100; // Store as Paisa for next year

          lastYear.isActive = false;
          lastYear.isClosed = true;
          // Save closing balance as Integer
          lastYear.closingBalance = derivedBalance / 100; 
          await lastYear.save();
       }
    }

    // 2. Determine Opening Balance
    let finalOpeningBalance = derivedBalance / 100; // Convert Paisa back to Rupees for Input
    if (openingBalance !== undefined && openingBalance !== "" && openingBalance !== null) {
        const inputVal = Number(openingBalance);
        if (!isNaN(inputVal)) {
            finalOpeningBalance = inputVal;
        }
    }

    // 3. Create New Year
    const newYear = await FestivalYear.create({
      club: clubId,
      name,
      startDate,
      endDate,
      openingBalance: finalOpeningBalance, // Input Rupees -> Mongoose saves Paisa
      subscriptionFrequency: frequency,
      totalInstallments: finalInstallments,
      amountPerInstallment: frequency === 'none' ? 0 : (Number(amountPerInstallment) || 0),
      isActive: true,
      isClosed: false,
      createdBy: userId
    });

    // ✅ LOG
    await logAction({
      req,
      action: "YEAR_STARTED",
      target: `New Cycle: ${name}`,
      details: { 
        openingBalance: finalOpeningBalance, 
        frequency: frequency,
        totalWeeks: finalInstallments
      }
    });

    res.status(201).json({
      success: true,
      message: `Cycle '${name}' started. Opening Balance: ${finalOpeningBalance}`,
      year: formatYear(newYear) // 💰 FIX: Format Response
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
      // 💰 FIX: Map and Format
      const formattedYears = years.map(y => formatYear(y));
      res.json({ success: true, data: formattedYears });
    } catch (err) { res.status(500).json({ message: "Server error" }); }
};

/**
 * @desc Get Currently Active Year
 */
exports.getActiveYear = async (req, res) => {
    try {
      const activeYear = await FestivalYear.findOne({ club: req.user.clubId, isActive: true });
      if (!activeYear) return res.status(404).json({ message: "No active year found." });
      
      // 💰 FIX: Format Single Object
      res.json({ success: true, data: formatYear(activeYear) });
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
    const currentFreq = yearDoc.subscriptionFrequency;
    const currentTotal = yearDoc.totalInstallments;
    
    // Parse current amount safely (Handle String getter or Raw number)
    const currentAmountRaw = yearDoc.get('amountPerInstallment', null, { getters: false });
    const currentAmount = currentAmountRaw / 100; // Convert Paisa -> Rupees

    const newFreq = subscriptionFrequency || currentFreq;
    const newTotal = Number(totalInstallments) || currentTotal;
    
    // Determine New Amount (Rupees)
    let newAmount = currentAmount;
    if (amountPerInstallment !== undefined && amountPerInstallment !== "") {
        newAmount = Number(amountPerInstallment);
    }

    const freqChanged = newFreq !== currentFreq;
    const durationChanged = newTotal !== currentTotal;
    const amountChanged = Math.abs(newAmount - currentAmount) > 0.001;

    // 3. Check for Existing Payments
    const subsWithPayments = await Subscription.countDocuments({
        year: id,
        "installments.isPaid": true
    });

    const hasPayments = subsWithPayments > 0;

    // --- VALIDATION ---

    // A. FREQUENCY CHANGE
    if (freqChanged && hasPayments) {
        throw new Error(`Cannot change Frequency (to ${newFreq}) because payments have already been collected.`);
    }

    // B. DURATION DECREASE
    if (durationChanged && newTotal < currentTotal) {
        const conflict = await Subscription.findOne({
            year: id,
            installments: {
                $elemMatch: {
                    number: { $gt: newTotal }, 
                    isPaid: true
                }
            }
        });

        if (conflict) {
            const badInst = conflict.installments.find(i => i.isPaid && i.number > newTotal);
            throw new Error(`Cannot reduce to ${newTotal} weeks. Installment #${badInst?.number} is already paid.`);
        }
    }

    // 4. Update Year Doc
    if (name) yearDoc.name = name;
    if (startDate) yearDoc.startDate = startDate;
    if (endDate) yearDoc.endDate = endDate;
    yearDoc.subscriptionFrequency = newFreq;
    yearDoc.totalInstallments = newTotal;
    yearDoc.amountPerInstallment = newAmount; // Assign Rupees

    // 5. Trigger Subscription Updates
    if (freqChanged || durationChanged || amountChanged) {
        await adjustSubscriptions({
            yearId: id,
            newFreq,
            newTotal,
            newAmount // Passing Number (Rupees)
        });
    }

    await yearDoc.save();

    // ✅ LOG
    await logAction({
      req,
      action: "YEAR_UPDATED",
      target: `Settings: ${yearDoc.name}`,
      details: { 
        amount: newAmount,
        frequency: newFreq,
        totalWeeks: newTotal
      }
    });

    res.json({ 
        success: true, 
        data: formatYear(yearDoc), // 💰 FIX: Format Response
        message: "Settings updated successfully." 
    });

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

    const year = await FestivalYear.findOne({ _id: id, club: clubId });
    if (!year) return res.status(404).json({ message: "Year not found" });

    // Assuming calculateBalance returns Rupees or String "500.00"
    const finalBalance = await calculateBalance(year._id, year.openingBalance);

    year.isActive = false;
    year.isClosed = true;
    year.closingBalance = Number(finalBalance); // Save as Rupees -> Mongoose converts to Paisa
    
    await year.save();

    await logAction({
      req,
      action: "YEAR_CLOSED",
      target: `Closed Cycle: ${year.name}`,
      details: { finalBalance: finalBalance }
    });

    res.json({ 
      success: true, 
      message: `Year '${year.name}' closed. Final Balance: ${finalBalance} saved.`,
      data: formatYear(year) // 💰 FIX: Format Response
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * 🛠 HELPER: Adjusts Subscriptions
 * @param {Number} newAmount - The amount in Rupees (e.g., 50)
 */
async function adjustSubscriptions({ yearId, newFreq, newTotal, newAmount }) {
    
    const subs = await Subscription.find({ year: yearId });
    if (subs.length === 0) return;

    console.log(`🔄 Adjusting ${subs.length} subs: Freq=${newFreq}, Total=${newTotal}, Amt=${newAmount}`);

    for (const sub of subs) {
        let installments = sub.installments;

        // CASE 1: Frequency Changed
        if (newFreq === 'none') {
            installments = [];
        } 
        else if (installments.length === 0 && newFreq !== 'none') {
            installments = generateInstallments(newTotal, newAmount);
        }
        else {
            // CASE 2: Duration Change
            if (newTotal > installments.length) {
                const startNum = installments.length + 1;
                const addedCount = newTotal - installments.length;
                const newItems = generateInstallments(addedCount, newAmount, startNum);
                installments = [...installments, ...newItems];
            }
            else if (newTotal < installments.length) {
                installments = installments.slice(0, newTotal);
            }

            // C. UPDATE AMOUNTS
            installments.forEach(inst => {
                inst.amountExpected = newAmount;
            });
        }

        // Recalculate Totals
        const paidCount = installments.filter(i => i.isPaid).length;
        const dueCount = installments.length - paidCount;

        sub.installments = installments;
        sub.totalPaid = paidCount * newAmount; 
        sub.totalDue = dueCount * newAmount;
        
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