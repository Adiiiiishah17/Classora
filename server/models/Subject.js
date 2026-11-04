const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    key: { type: String, required: true, unique: true, lowercase: true }, // for case-insensitive matching
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subject", subjectSchema);