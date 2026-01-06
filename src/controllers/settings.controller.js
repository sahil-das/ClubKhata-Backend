const FestivalYear = require("../models/FestivalYear");
const calculateBalance = require("../utils/calculateBalance"); 
const Subscription = require("../models/Subscription");
const { logAction } = require("../utils/auditLogger");

// ... (createYear, getAllYears, getActiveYear remain as previously fixed) ...

/**
 * @route PUT /api/v1/years/:id
 * @desc Update Active Year Settings (Secure & Synchronized)
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
    if (!yearDoc) return res.status(404).json({ message: "Year not found" });

    // 2. Detect Changes
    const currentFreq = yearDoc.subscriptionFrequency;
    const currentTotal = yearDoc.totalInstallments;
    // Parse current amount (Getter returns string "50.00", we need float 50.00)
    const currentAmount = parseFloat(yearDoc.amountPerInstallment);

    const newFreq = subscriptionFrequency || currentFreq;
    const newTotal = Number(totalInstallments) || currentTotal;
    
    // Handle Amount Input: Allow 0, ensure it's a Number (Rupees)
    let newAmount = currentAmount;
    if (amountPerInstallment !== undefined && amountPerInstallment !== "") {
        newAmount = Number(amountPerInstallment);
    }

    const freqChanged = newFreq !== currentFreq;
    const durationChanged = newTotal !== currentTotal;
    const amountChanged = Math.abs(newAmount - currentAmount) > 0.001;

    // 3. Safety Check: Prevent breaking existing payments
    const subsWithPayments = await Subscription.countDocuments({
        year: id,
        "installments.isPaid": true
    });

    const hasPayments = subsWithPayments > 0;

    // A. FREQUENCY CHANGE
    if (freqChanged && hasPayments) {
        return res.status(400).json({ 
            message: `Cannot change Frequency (to ${newFreq}) because payments have already been collected.` 
        });
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
            return res.status(400).json({ 
                message: `Cannot reduce to ${newTotal} weeks. Installment #${badInst?.number} is already paid for a member.` 
            });
        }
    }

    // 4. Update Year Doc
    if (name) yearDoc.name = name;
    if (startDate) yearDoc.startDate = startDate;
    if (endDate) yearDoc.endDate = endDate;
    yearDoc.subscriptionFrequency = newFreq;
    yearDoc.totalInstallments = newTotal;
    // Assign Number (Rupees). Mongoose setter -> Integer (Paise)
    yearDoc.amountPerInstallment = newAmount;

    // 5. Trigger Subscription Updates (Sync all members to new rules)
    if (freqChanged || durationChanged || amountChanged) {
        await adjustSubscriptions({
            yearId: id,
            newFreq,
            newTotal,
            newAmount // Passing Number (Rupees) e.g. 50
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

    res.json({ success: true, data: yearDoc, message: "Settings updated successfully." });

  } catch (err) {
    console.error("Update Year Error:", err);
    res.status(500).json({ message: err.message || "Server Error" });
  }
};

/**
 * @route POST /api/v1/years/:id/close
 * @desc Close the financial year and Freeze Balance
 */
exports.closeYear = async (req, res) => {
  try {
    const { id } = req.params;
    const { clubId } = req.user;

    const year = await FestivalYear.findOne({ _id: id, club: clubId });
    if (!year) return res.status(404).json({ message: "Year not found" });

    // 1. Calculate Final Balance one last time
    const finalBalance = await calculateBalance(year._id, year.openingBalance);

    // 2. Freeze Data
    year.isActive = false;
    year.isClosed = true;
    year.closingBalance = finalBalance; // ✅ STORED PERMANENTLY
    
    await year.save();

    // ✅ LOG
    await logAction({
      req,
      action: "YEAR_CLOSED",
      target: `Closed Cycle: ${year.name}`,
      details: { finalBalance: finalBalance }
    });

    res.json({ 
      success: true, 
      message: `Year '${year.name}' closed. Final Balance: ${finalBalance} saved.`,
      data: year
    });

  } catch (err) {
    console.error("Close Year Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * 🛠 HELPER: Adjusts Subscriptions (No Session Version)
 * @param {Number} newAmount - The amount in Rupees (e.g., 50)
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
            
            // A. EXTEND
            if (newTotal > installments.length) {
                const startNum = installments.length + 1;
                const addedCount = newTotal - installments.length;
                const newItems = generateInstallments(addedCount, newAmount, startNum);
                installments = [...installments, ...newItems];
            }
            // B. REDUCE
            else if (newTotal < installments.length) {
                installments = installments.slice(0, newTotal);
            }

            // C. UPDATE AMOUNTS
            // Set amountExpected to Rupees (50). Setter converts to 5000.
            installments.forEach(inst => {
                inst.amountExpected = newAmount;
            });
        }

        // Recalculate Totals (💰 MATH FIX)
        // We use 'newAmount' (Number) directly. 
        // DO NOT read inst.amountExpected from Doc here, as it might return "50.00" string.
        const paidCount = installments.filter(i => i.isPaid).length;
        const dueCount = installments.length - paidCount;

        sub.installments = installments;
        
        // Assign Rupees. Setter converts to Paise.
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