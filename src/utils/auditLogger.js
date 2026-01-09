const AuditLog = require("../models/AuditLog");

/**
 * Records an activity in the database.
 * CRITICAL FIX: Removed try/catch to ensure transaction aborts if logging fails.
 * * @param {Object} req - Express Request Object
 * @param {String} action - Short code (e.g. "UPDATE_SETTINGS")
 * @param {String} target - Human readable target
 * @param {Object} details - Optional JSON data
 * @param {Object} session - (Optional) Mongoose Transaction Session
 */
exports.logAction = async ({ req, action, target, details, session = null }) => {
  // 1. Basic Context Check
  if (!req.user || !req.user.clubId) return;

  // 2. Create Log (Passed session ensures atomicity)
  await AuditLog.create([{
    club: req.user.clubId,
    actor: req.user.id,
    action,
    target,
    details,
    ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
  }], { session });
};