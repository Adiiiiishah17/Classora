const mongoose = require("mongoose");

const classGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    key: { type: String, required: true, unique: true, lowercase: true }, // for matching "10-a" and "10-A"
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClassGroup", classGroupSchema);