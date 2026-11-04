const mongoose = require("mongoose");

const teacherProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    employeeId: { type: String, trim: true, maxlength: 30 },
    classNames: [{ type: String, trim: true, maxlength: 40 }], // typed, may be empty
    subjects: [{ type: String, trim: true, maxlength: 50 }],
    bio: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

teacherProfileSchema.index({ classNames: 1 });
teacherProfileSchema.index({ subjects: 1 });

module.exports = mongoose.model("TeacherProfile", teacherProfileSchema);