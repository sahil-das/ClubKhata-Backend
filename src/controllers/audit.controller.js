const AuditLog = require("../models/AuditLog");

exports.getLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, action, startDate, endDate, actorId } = req.query;
    
    // 1. Build Query Object
    const query = { club: req.user.clubId };

    // Filter by Action Type
    if (action && action !== "ALL") {
      query.action = action;
    }

    // Filter by Date Range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59));
    }

    // Filter by Specific Admin (Actor)
    if (actorId) {
      query.actor = actorId;
    }

    // 2. Execute Query with Pagination
    const logs = await AuditLog.find(query)
      .populate("actor", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // 3. Get Total Count (for Frontend Pagination)
    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error("Audit Log Error:", err);
    res.status(500).json({ message: "Server error fetching logs" });
  }
};