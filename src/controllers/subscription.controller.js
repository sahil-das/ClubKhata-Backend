const Subscription = require("../models/Subscription");
const FestivalYear = require("../models/FestivalYear");
const Membership = require("../models/Membership");
const { logAction } = require("../utils/auditLogger");
const { toClient } = require("../utils/mongooseMoney"); // 👈 IMPORT THIS

/**
 * @desc Get Subscription Card & Self-Heal Data
 * @route GET /api/v1/subscriptions/member/:memberId
 */
exports.getMemberSubscription = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { clubId } = req.user;

    // 1. Get Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active year found. Please start a year in Dashboard." });

    // 2. Fetch Membership & User Details
    const memberShip = await Membership.findById(memberId).populate("user");
    if (!memberShip) return res.status(404).json({ message: "Member not found" });

    const memberName = memberShip.user ? memberShip.user.name : "Unknown Member";
    const memberUserId = memberShip.user ? memberShip.user._id : null; 

    // 3. Find Subscription
    let sub = await Subscription.findOne({ 
      club: clubId, 
      year: activeYear._id, 
      member: memberId 
    });

    // 4. Get Target Amount (Raw Integer from DB, e.g., 5000)
    const targetAmountInt = activeYear.get('amountPerInstallment', null, { getters: false }) || 0;
    const targetCount = activeYear.totalInstallments || 52;

    // --- SELF HEALING LOGIC ---
    // If subscription doesn't exist or amounts are wrong, fix them here
    if (!sub) {
      // Create New
      const installments = [];
      for (let i = 1; i <= targetCount; i++) {
        installments.push({
          number: i,
          amountExpected: targetAmountInt / 100, // 💰 Assign Rupees (Setter x100)
          isPaid: false
        });
      }

      sub = await Subscription.create({
        club: clubId,
        year: activeYear._id,
        member: memberId,
        installments: installments,
        totalDue: (targetCount * targetAmountInt) / 100 // 💰 Assign Rupees
      });
    } else {
      // Fix Existing Data (Sync amount with current Year settings)
      const rawInstallments = sub.toObject({ getters: false }).installments || [];
      const needsUpdate = rawInstallments.some(i => i.amountExpected !== targetAmountInt);
      
      if (needsUpdate && targetAmountInt > 0) {
        // Assign Rupees to trigger Setter (x100)
        sub.installments.forEach(i => { i.amountExpected = targetAmountInt / 100; });
        
        const paidCount = sub.installments.filter(i => i.isPaid).length;
        
        // Calculate Totals (Paisa) then Divide by 100 for Assignment
        const totalPaidPaisa = paidCount * targetAmountInt;
        const totalDuePaisa = (sub.installments.length * targetAmountInt) - totalPaidPaisa;

        sub.totalPaid = totalPaidPaisa / 100; 
        sub.totalDue = totalDuePaisa / 100;
        
        await sub.save();
      }
    }

    // 💰 MANUAL FORMATTING FOR CLIENT
    // ----------------------------------------------------
    const subObj = sub.toObject();

    // Format Root Totals
    subObj.totalPaid = toClient(sub.get('totalPaid', null, { getters: false }));
    subObj.totalDue = toClient(sub.get('totalDue', null, { getters: false }));

    // Format Installments Array
    if (sub.installments) {
        subObj.installments = sub.installments.map(inst => {
            const instObj = inst.toObject();
            instObj.amountExpected = toClient(inst.get('amountExpected', null, { getters: false }));
            return instObj;
        });
    }
    // ----------------------------------------------------

    res.json({
      success: true,
      data: {
        subscription: subObj, // 👈 Send formatted object
        memberName: memberName,
        memberUserId: memberUserId,
        rules: {
          name: activeYear.name,
          frequency: activeYear.subscriptionFrequency,
          amount: toClient(targetAmountInt)
        }
      }
    });

  } catch (err) {
    console.error("Subscription Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * @desc Pay Installment
 * @route POST /api/v1/subscriptions/pay
 */
exports.payInstallment = async (req, res) => {
  try {
    const { subscriptionId, installmentNumber } = req.body;
    
    const sub = await Subscription.findById(subscriptionId).populate("year");
    if (!sub) return res.status(404).json({ message: "Subscription not found" });

    // Security Checks
    if (sub.year.subscriptionFrequency === 'none') {
       return res.status(400).json({ message: "Subscriptions are disabled." });
    }
    if (req.user.role !== "admin") {
       return res.status(403).json({ message: "Only Admins can update payments." });
    }

    const installment = sub.installments.find(i => i.number === installmentNumber);
    if (!installment) return res.status(404).json({ message: "Invalid Installment" });

    // Toggle Status
    const newStatus = !installment.isPaid;
    installment.isPaid = newStatus;
    installment.paidDate = newStatus ? new Date() : null;
    installment.collectedBy = newStatus ? req.user.id : null;

    // Recalculate Totals (Using Raw Integers)
    let newPaidPaisa = 0;
    let newDuePaisa = 0;
    
    sub.installments.forEach(i => {
        const val = i.get('amountExpected', null, { getters: false }) || 0;
        if(i.isPaid) newPaidPaisa += val;
        else newDuePaisa += val;
    });

    // 💰 FIX: Divide by 100 before assigning (Mongoose Setter will multiply back)
    sub.totalPaid = newPaidPaisa / 100;
    sub.totalDue = newDuePaisa / 100;

    await sub.save();

    // Log Action
    const memberName = sub.member?.user?.name || "Member";
    const logAmount = toClient(installment.get('amountExpected', null, { getters: false }));

    await logAction({
      req,
      action: newStatus ? "SUBSCRIPTION_PAID" : "SUBSCRIPTION_REVOKED",
      target: `Sub: ${memberName} (Week #${installmentNumber})`,
      details: { amount: logAmount, status: newStatus ? "Paid" : "Unpaid" }
    });

    // 💰 MANUAL FORMATTING FOR CLIENT
    // ----------------------------------------------------
    const subObj = sub.toObject();

    subObj.totalPaid = toClient(sub.get('totalPaid', null, { getters: false }));
    subObj.totalDue = toClient(sub.get('totalDue', null, { getters: false }));

    subObj.installments = sub.installments.map(inst => {
        const instObj = inst.toObject();
        instObj.amountExpected = toClient(inst.get('amountExpected', null, { getters: false }));
        return instObj;
    });
    // ----------------------------------------------------

    res.json({ success: true, data: subObj });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Payment Failed" });
  }
};


/**
 * @desc Get ALL Payments for the Active Year (For Reports)
 * @route GET /api/v1/subscriptions/payments
 */
exports.getAllPayments = async (req, res) => {
  try {
    const { clubId } = req.user;

    // 1. Get Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.json({ success: true, data: [] });

    // 2. Fetch all subscriptions for this year
    // We use Mongoose docs here (not .lean()) to use the .get() method easily
    const subs = await Subscription.find({ club: clubId, year: activeYear._id })
      .populate({
        path: "member",
        populate: { path: "user", select: "name" }
      });

    // 3. Extract PAID installments into a flat list
    let allPayments = [];

    subs.forEach(sub => {
      const memberName = sub.member?.user?.name || "Unknown Member";

      if (sub.installments) {
        sub.installments.forEach(inst => {
          if (inst.isPaid) {
            allPayments.push({
              subscriptionId: sub._id,
              memberId: sub.member?._id,
              memberName: memberName,
              
              // 💰 FIX: Explicitly format to "50.00" string
              amount: toClient(inst.get('amountExpected', null, { getters: false }) || 0),
              
              date: inst.paidDate || sub.updatedAt, 
              weekNumber: inst.number,
              type: "subscription"
            });
          }
        });
      }
    });

    // Sort by Date (Most recent first)
    allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, data: allPayments });

  } catch (err) {
    console.error("Fetch Payments Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};