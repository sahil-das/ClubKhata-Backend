const FestivalYear = require("../models/FestivalYear");
const Expense = require("../models/Expense");
const MemberFee = require("../models/MemberFee");
const Donation = require("../models/Donation");
const Subscription = require("../models/Subscription");
const { toClient } = require("../utils/mongooseMoney"); // 👈 IMPORT

/**
 * @desc Get List of Closed Years
 * @route GET /api/v1/archives
 */
exports.getArchivedYears = async (req, res) => {
  try {
    const { clubId } = req.user;
    
    // Fetch only closed years, sorted by most recent
    const closedYears = await FestivalYear.find({ 
      club: clubId, 
      isClosed: true 
    })
    .select("name startDate endDate closingBalance") 
    .sort({ endDate: -1 });

    // 💰 FIX: Format closingBalance to "50.00" string
    const formattedYears = closedYears.map(y => {
        const obj = y.toObject();
        obj.closingBalance = toClient(y.get('closingBalance', null, { getters: false }));
        return obj;
    });

    res.json({ success: true, data: formattedYears });
  } catch (err) {
    console.error("Archive List Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Get Full Report for a Specific Year
 * @route GET /api/v1/archives/:yearId
 */
exports.getArchiveDetails = async (req, res) => {
  try {
    const { yearId } = req.params;
    const { clubId } = req.user;

    // 1. Verify the Year exists
    const yearDoc = await FestivalYear.findOne({ _id: yearId, club: clubId });
    if (!yearDoc) return res.status(404).json({ message: "Year record not found" });

    // 2. Parallel Fetching
    const [expenses, fees, donations, subscriptions] = await Promise.all([
      // A. Expenses
      Expense.find({ club: clubId, year: yearId, status: "approved" }).sort({ date: -1 }),
      // B. Puja Fees
      MemberFee.find({ club: clubId, year: yearId }).populate("user", "name").sort({ createdAt: -1 }),
      // C. Donations
      Donation.find({ club: clubId, year: yearId }).sort({ date: -1 }),
      // D. Subscriptions
      Subscription.find({ club: clubId, year: yearId })
    ]);

    // 3. Calculate Totals (⚠️ USE RAW INTEGERS TO AVOID STRING CONCAT)
    
    const totalExpenseInt = expenses.reduce((sum, e) => {
        return sum + (e.get('amount', null, { getters: false }) || 0);
    }, 0);

    const totalFeesInt = fees.reduce((sum, f) => {
        return sum + (f.get('amount', null, { getters: false }) || 0);
    }, 0);

    const totalDonationsInt = donations.reduce((sum, d) => {
        return sum + (d.get('amount', null, { getters: false }) || 0);
    }, 0);
    
    // Calculate Subscription Collection
    let totalSubscriptionCollectedInt = 0;
    subscriptions.forEach(sub => {
        if (sub.installments) {
            sub.installments.forEach(inst => {
                if (inst.isPaid) {
                    // Access raw integer from subdocument
                    const amount = inst.get('amountExpected', null, { getters: false }) || 0;
                    totalSubscriptionCollectedInt += amount;
                }
            });
        }
    });

    const totalIncomeInt = totalSubscriptionCollectedInt + totalFeesInt + totalDonationsInt;
    
    // Get raw opening/closing balance
    const openingBalanceInt = yearDoc.get('openingBalance', null, { getters: false }) || 0;
    const closingBalanceInt = yearDoc.get('closingBalance', null, { getters: false }) || 0;

    // 4. Construct Financial Summary (Convert to Strings for Client)
    const financialSummary = {
      openingBalance: toClient(openingBalanceInt),
      income: {
        subscriptions: toClient(totalSubscriptionCollectedInt),
        fees: toClient(totalFeesInt),
        donations: toClient(totalDonationsInt),
        total: toClient(totalIncomeInt)
      },
      expense: toClient(totalExpenseInt),
      netBalance: toClient(closingBalanceInt) // Truth from DB
    };

    // 💰 FIX: Format Records Lists (Map & Convert)
    const formattedExpenses = expenses.map(e => {
        const obj = e.toObject();
        obj.amount = toClient(e.get('amount', null, { getters: false }));
        return obj;
    });

    const formattedFees = fees.map(f => {
        const obj = f.toObject();
        obj.amount = toClient(f.get('amount', null, { getters: false }));
        return obj;
    });

    const formattedDonations = donations.map(d => {
        const obj = d.toObject();
        obj.amount = toClient(d.get('amount', null, { getters: false }));
        return obj;
    });

    res.json({
      success: true,
      data: {
        info: yearDoc, 
        summary: financialSummary,
        records: {
          expenses: formattedExpenses,  // ✅ Now "50.00"
          fees: formattedFees,          // ✅ Now "50.00"
          donations: formattedDonations // ✅ Now "50.00"
        }
      }
    });

  } catch (err) {
    console.error("Archive Detail Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};