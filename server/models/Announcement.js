const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    audience: { type: String, enum: ["all", "students", "teachers", "class"], required: true },
    className: { type: String, trim: true, maxlength: 40 },
    urgent: { type: Boolean, default: false },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, maxlength: 100 },
    authorRole: { type: String, maxlength: 20 },
  },
  { timestamps: true }
);

announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ audience: 1, className: 1, createdAt: -1 });

module.exports = mongoose.model("Announcement", announcementSchema);