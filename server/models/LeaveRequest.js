const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    applicantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    applicantRole: { type: String, enum: ["student", "teacher"], required: true },
    className: { type: String, trim: true, maxlength: 40 }, // students: class at the time of applying
    fromDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    toDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending" },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decidedAt: { type: Date },
    decisionNote: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

leaveSchema.index({ applicantId: 1, createdAt: -1 });
leaveSchema.index({ status: 1, className: 1, createdAt: -1 });

module.exports = mongoose.model("LeaveRequest", leaveSchema);