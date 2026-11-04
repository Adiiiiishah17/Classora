const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^(?=.*[a-z])[a-z0-9._]+$/,
    },
    phone: { type: String, unique: true, sparse: true, trim: true, match: /^[6-9]\d{9}$/ },
    passwordHash: { type: String, required: false, select: false },
    googleId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ["admin", "teacher", "student"], required: true },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    failedLoginCount: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLoginAt: { type: Date },
    photoName: { type: String, maxlength: 60 }, 
    photoUpdatedAt: { type: Date },
        dob: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ }, // date of birth, "YYYY-MM-DD"

    // Login code (only the hash is stored)
    loginCodeHash: { type: String, select: false, unique: true, sparse: true },
    loginCodeEnc: { type: String, select: false },
    loginCodeCreatedAt: { type: Date },
    loginCodeLastUsedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);