const AuditLog = require("../models/AuditLog");

exports.getLogs = async (req, res) => {
  try {
    let { page = 1, limit = 20, action, startDate, endDate, actorId } = req.query;
    
    // 1. Sanitize Pagination & Limit (DoS Protection)
    // Ensure positive integers and CAP the limit to 100
    page = Math.max(1, parseInt(page) || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit) || 20)); 

    // 2. Build Query Object
    const query = { club: req.user.clubId };

    // Filter by Action Type
    if (action && action !== "ALL") {
      query.action = action;
    }

    // Filter by Date Range (Robust Parsing)
    if (startDate || endDate) {
      query.createdAt = {};
      
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
             query.createdAt.$gte = start;
        }
      }
      
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
            // Set to very end of that day (23:59:59.999)
            end.setHours(23, 59, 59, 999);
            query.createdAt.$lte = end;
        }
      }
    }

    // Filter by Specific Admin (Actor)
    if (actorId) {
      query.actor = actorId;
    }

    // 3. Execute Query with Pagination (LEAN for Performance)
    const logs = await AuditLog.find(query)
      .populate("actor", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(); // 🚀 Returns plain JSON (Faster than Mongoose Docs)

    // 4. Get Total Count (for Frontend Pagination)
    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error("Audit Log Error:", err);
    res.status(500).json({ message: "Server error fetching logs" });
  }
};