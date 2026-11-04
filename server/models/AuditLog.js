const mongoose = require("mongoose");

const auditSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorName: { type: String, maxlength: 100 },
    actorRole: { type: String, maxlength: 20 },
    action: { type: String, required: true, maxlength: 60 },
    targetType: { type: String, maxlength: 30 },
    targetId: { type: String, maxlength: 60 },
    summary: { type: String, maxlength: 300 },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditSchema);