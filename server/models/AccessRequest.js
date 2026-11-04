const mongoose = require("mongoose");

const accessRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    username: { type: String, lowercase: true, trim: true, maxlength: 30 },
    phone: { type: String, trim: true, maxlength: 10 },
    dob: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    role: { type: String, enum: ["student", "teacher"], required: true },
    passwordHash: { type: String, select: false }, // deleted as soon as the request is approved
    className: { type: String, trim: true, maxlength: 40 },                 // students
    classNames: [{ type: String, trim: true, maxlength: 40 }],              // teachers
    subjects: [{ type: String, trim: true, maxlength: 50 }],
    message: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    createdUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// One pending request per email, username and phone
accessRequestSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });
accessRequestSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { status: "pending", username: { $type: "string" } } }
);
accessRequestSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { status: "pending", phone: { $type: "string" } } }
);

module.exports = mongoose.model("AccessRequest", accessRequestSchema);