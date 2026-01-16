const Budget = require("../models/Budget");
const Expense = require("../models/Expense");
const FestivalYear = require("../models/FestivalYear");
const mongooseMoney = require("../utils/mongooseMoney");
const { logAction } = require("../utils/auditLogger");

/**
 * @desc Get Budget Analysis (Includes Unplanned Expenses)
 */
exports.getBudgetAnalysis = async (req, res) => {
  try {
    const { clubId } = req.user;
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.json({ success: true, data: [] });

    // 1. Fetch Planned Budgets
    const budgets = await Budget.find({ 
        club: clubId, 
        year: activeYear._id,
        isDeleted: false 
    });

    // 2. Fetch Actual Expenses (Grouped by Category)
    const expenseStats = await Expense.aggregate([
        { 
            $match: { 
                club: activeYear.club, 
                year: activeYear._id,
                isDeleted: false,
                status: "approved"
            } 
        },
        { 
            $group: { 
                _id: { $toLower: "$category" }, // Case-insensitive grouping
                originalName: { $first: "$category" }, // Keep one version of the name for display
                totalSpentPaise: { $sum: "$amount" }
            } 
        }
    ]);

    // 3. Create Lookup Maps
    const budgetMap = {}; 
    budgets.forEach(b => { budgetMap[b.category.toLowerCase()] = b; });

    const expenseMap = {};
    const expenseNameMap = {}; // To store pretty names for unplanned items
    expenseStats.forEach(stat => { 
        expenseMap[stat._id] = stat.totalSpentPaise; 
        expenseNameMap[stat._id] = stat.originalName;
    });

    // 4. Merge All Unique Categories
    const allCategories = new Set([
        ...Object.keys(budgetMap),
        ...Object.keys(expenseMap)
    ]);

    // 5. Build Final Analysis List
    const analysis = [];
    
    allCategories.forEach(catKey => {
        const budget = budgetMap[catKey];
        const spentPaise = expenseMap[catKey] || 0;
        
        // Use Budget values if available, otherwise defaults
        const allocatedPaise = budget ? mongooseMoney.toDB(budget.allocatedAmount) : 0;
        const allocatedClient = budget ? Number(budget.allocatedAmount) : 0;
        
        // Name: Use Budget name (preferred) or Expense name (fallback)
        const displayName = budget ? budget.category : (expenseNameMap[catKey] || catKey);
        
        // ID: Use Budget ID or a dummy ID for unplanned
        const id = budget ? budget._id : `unplanned_${catKey}`; 

        // Calculate Status
        const percentage = allocatedPaise > 0 
            ? Math.round((spentPaise / allocatedPaise) * 100) 
            : (spentPaise > 0 ? 100 : 0); // 100% used if 0 allocated but money spent

        let status = "good";
        if (!budget && spentPaise > 0) status = "unplanned"; // ⚠️ New Status
        else if (percentage >= 100) status = "overbudget";
        else if (percentage >= 90) status = "warning";

        analysis.push({
            _id: id,
            category: displayName,
            allocated: allocatedClient,
            spent: Number(mongooseMoney.toClient(spentPaise)),
            percentageUsed: percentage,
            status,
            isUnplanned: !budget // Flag for UI
        });
    });

    res.json({ success: true, data: analysis });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Set/Update Budget (Handles Reactivation)
 */
exports.setBudget = async (req, res) => {
  try {
    const { clubId } = req.user;
    const { category, amount } = req.body;

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active financial year." });

    // Update or Insert (Upsert)
    // If deleted, this reactivates it (isDeleted: false)
    const budget = await Budget.findOneAndUpdate(
        { club: clubId, year: activeYear._id, category: category }, 
        { 
            allocatedAmount: amount,
            isDeleted: false 
        }, 
        { new: true, upsert: true } 
    );

    await logAction({
        req,
        action: "BUDGET_SET",
        target: `${category}: ${amount}`
    });

    res.json({ success: true, data: budget });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Delete Budget (Soft Delete)
 */
exports.deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const { clubId } = req.user;

    const budget = await Budget.findOneAndUpdate(
        { _id: id, club: clubId },
        { isDeleted: true },
        { new: true }
    );

    if (!budget) return res.status(404).json({ message: "Budget not found" });

    await logAction({
        req,
        action: "BUDGET_DELETED",
        target: budget.category
    });

    res.json({ success: true, message: "Budget deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Delete Budget (Soft Delete)
 */
exports.deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const { clubId } = req.user;

    const budget = await Budget.findOneAndUpdate(
        { _id: id, club: clubId },
        { isDeleted: true },
        { new: true }
    );

    if (!budget) return res.status(404).json({ message: "Budget not found" });

    await logAction({
        req,
        action: "BUDGET_DELETED",
        target: budget.category
    });

    res.json({ success: true, message: "Budget deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};