const MemberFee = require("../models/MemberFee");
const FestivalYear = require("../models/FestivalYear");
const Membership = require("../models/Membership");
const User = require("../models/User"); 
const { logAction } = require("../utils/auditLogger");
const { toClient } = require("../utils/mongooseMoney"); // 👈 Ensure this is imported

/**
 * @route POST /api/v1/member-fees
 * @desc Record a payment (Chanda)
 */
exports.createPayment = async (req, res) => {
  try {
    const { userId, amount, notes } = req.body;
    const { clubId, id: adminId, role } = req.user;

    // ✅ AUTH CHECK: Only Admins can collect money
    if (role !== 'admin') {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(404).json({ message: "No active festival year." });

    // ✅ FETCH USER NAME FOR LOGS
    const userObj = await User.findById(userId);
    const memberName = userObj ? userObj.name : "Unknown Member";

    const fee = await MemberFee.create({
      club: clubId,
      year: activeYear._id,
      user: userId,
      amount, // Input is Rupees (e.g. 50), Setter saves Paisa (5000)
      collectedBy: adminId,
      notes
    });
  
    // ✅ LOG THE ACTION
    await logAction({
      req,
      action: "PAYMENT_COLLECTED",
      target: `Chanda: ${memberName}`,
      details: { amount: amount, notes: notes }
    });
    
    // 💰 FIX: Send formatted Rupees to Frontend
    // We get the raw integer (5000) -> convert to client string ("50.00")
    const feeObj = fee.toObject();
    feeObj.amount = toClient(fee.get('amount', null, { getters: false }));

    res.status(201).json({ success: true, message: "Payment recorded", data: feeObj });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route GET /api/v1/member-fees
 * @desc Get raw list of transactions (for history/logs)
 */
exports.getAllFees = async (req, res) => {
  try {
    const { clubId } = req.user;
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(404).json({ message: "No active year." });

    const fees = await MemberFee.find({ club: clubId, year: activeYear._id })
      .populate("user", "name email")
      .populate("collectedBy", "name")
      .sort({ createdAt: -1 });

    // 💰 FIX: Format all records to Rupees string
    const formattedFees = fees.map(f => {
        const obj = f.toObject();
        obj.amount = toClient(f.get('amount', null, { getters: false }));
        return obj;
    });

    res.json({ success: true, data: formattedFees });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route GET /api/v1/member-fees/summary
 * @desc Get All Members with their Total Paid status (For Collection Matrix)
 */
exports.getFeeSummary = async (req, res) => {
  try {
    const { clubId } = req.user;

    // 1. Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active festival year." });

    // 2. Get All Members
    const memberships = await Membership.find({ club: clubId }).populate("user", "name email phone");
    
    // 3. Aggregate Fees for this Year (Returns Integers)
    const fees = await MemberFee.aggregate([
      { $match: { club: clubId, year: activeYear._id } },
      { $group: { 
          _id: "$user", 
          totalPaid: { $sum: "$amount" }, // Sum of Integer Paise
          lastPaidAt: { $max: "$createdAt" },
          count: { $sum: 1 }
        } 
      }
    ]);

    // 4. Map Fees to Members
    const feeMap = {};
    fees.forEach(f => { feeMap[f._id.toString()] = f; });

    const summary = memberships.map(m => {
        const userId = m.user._id.toString();
        const feeData = feeMap[userId];
        const rawTotal = feeData?.totalPaid || 0; // Integer value

        return {
            memberId: userId,
            name: m.user.name,
            email: m.user.email,
            // 💰 Fix: Convert Integer to "50.00" string for display
            totalPaid: toClient(rawTotal), 
            // Keep raw for sorting
            rawTotal: rawTotal,
            lastPaidAt: feeData?.lastPaidAt || null,
            transactionCount: feeData?.count || 0
        };
    });

    // Sort: Unpaid first, then by Name
    summary.sort((a, b) => {
        if (a.rawTotal === 0 && b.rawTotal > 0) return -1;
        if (a.rawTotal > 0 && b.rawTotal === 0) return 1;
        return a.name.localeCompare(b.name);
    });

    res.json({ success: true, data: summary });

  } catch (err) {
    console.error("Fee Summary Error:", err);
    res.status(500).json({ message: "Server error fetching summary" });
  }
};

/**
 * @route DELETE /api/v1/member-fees/:id
 */
exports.deletePayment = async (req, res) => {
  try {
    // 1. Find the fee first (so we can log what we are deleting)
    const fee = await MemberFee.findOne({ _id: req.params.id, club: req.user.clubId })
      .populate("user", "name"); 

    if (!fee) return res.status(404).json({ message: "Record not found" });

    // 2. Delete it
    await MemberFee.findByIdAndDelete(fee._id);

    // ✅ LOG THE DELETION
    await logAction({
      req,
      action: "PAYMENT_DELETED",
      target: `Deleted Chanda: ${fee.user?.name || "Unknown User"}`,
      details: { 
        amount: fee.amount, // Log logic usually handles string/number fine
        originalDate: fee.createdAt 
      }
    });

    res.json({ success: true, message: "Record deleted" });
  } catch (err) {
    console.error(err); 
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ NEW: Get fees for a specific member (for MemberDetails page)
exports.getMemberFees = async (req, res) => {
  try {
    const { userId } = req.params;
    const { clubId } = req.user;

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(404).json({ message: "No active year" });

    // Fetch records
    const fees = await MemberFee.find({ 
      club: clubId, 
      year: activeYear._id,
      user: userId 
    }).populate("collectedBy", "name");

    // 💰 Fix: Calculate Total from Raw Integers to avoid string concatenation
    const totalInt = fees.reduce((sum, f) => {
      // Access raw value to avoid "50.00" + "50.00" = "50.0050.00"
      const rawAmount = f.get('amount', null, { getters: false }) || 0;
      return sum + rawAmount;
    }, 0);

    // 💰 Fix: Format records too
    const formattedRecords = fees.map(f => {
        const obj = f.toObject();
        obj.amount = toClient(f.get('amount', null, { getters: false }));
        return obj;
    });

    res.json({ 
      success: true, 
      data: {
        total: toClient(totalInt), // Format to "100.00"
        records: formattedRecords
      } 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};