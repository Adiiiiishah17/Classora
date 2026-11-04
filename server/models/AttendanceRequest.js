const mongoose = require("mongoose");

const attendanceRequestSchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    note: { type: String, required: true, trim: true, maxlength: 300 },
    status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending" },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decidedAt: { type: Date },
    decisionNote: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

attendanceRequestSchema.index({ teacherId: 1, createdAt: -1 });
attendanceRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("AttendanceRequest", attendanceRequestSchema);