const AuditLog = require("../models/AuditLog");

// Writes one line to the activity log. A failure here never breaks the request.
async function audit(req, action, { targetType, targetId, summary, meta } = {}) {
  try {
    await AuditLog.create({
      actorId: req.user?.id,
      actorName: req.user?.name,
      actorRole: req.user?.role,
      action,
      targetType,
      targetId: targetId ? String(targetId) : undefined,
      summary,
      meta,
    });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
}

module.exports = { audit };