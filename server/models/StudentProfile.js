const mongoose = require("mongoose");

const studentProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    className: { type: String, trim: true, maxlength: 40 }, // typed by a person, e.g. "10-A"
    rollNumber: { type: String, trim: true, maxlength: 20 }, // only when there is a class
    subjects: [{ type: String, trim: true, maxlength: 50 }],
    guardianName: { type: String, trim: true, maxlength: 100 },
    guardianPhone: { type: String, trim: true, maxlength: 20 },
  },
  { timestamps: true }
);

// Roll numbers are unique inside a class. Students without a class are ignored.
studentProfileSchema.index(
  { className: 1, rollNumber: 1 },
  { unique: true, partialFilterExpression: { className: { $type: "string" }, rollNumber: { $type: "string" } } }
);
studentProfileSchema.index({ className: 1 });
studentProfileSchema.index({ subjects: 1 });

module.exports = mongoose.model("StudentProfile", studentProfileSchema);