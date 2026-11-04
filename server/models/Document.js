const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    audience: { type: String, enum: ["all", "students", "teachers", "class"], required: true },
    className: { type: String, trim: true, maxlength: 40 },
    originalName: { type: String, required: true, maxlength: 160 },
    storedName: { type: String, required: true, maxlength: 80 }, // random name on disk, never shown to users
    ext: { type: String, enum: ["pdf", "txt", "csv", "docx", "pptx", "jpg", "png", "svg"], default: "pdf" },
    size: { type: Number, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, maxlength: 100 },
    authorRole: { type: String, maxlength: 20 },
  },
  { timestamps: true }
);

documentSchema.index({ createdAt: -1 });
documentSchema.index({ audience: 1, className: 1, createdAt: -1 });

module.exports = mongoose.model("Document", documentSchema);