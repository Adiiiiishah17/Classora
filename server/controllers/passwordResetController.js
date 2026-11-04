const crypto = require("crypto");
const User = require("../models/User");
const PasswordReset = require("../models/PasswordReset");
const { hashPassword } = require("../utils/password");
const { sendMail } = require("../utils/mailer");

const TTL_MS = 15 * 60 * 1000;     // link valid for 15 minutes
const COOLDOWN_MS = 60 * 1000;     // at most one email per minute per account
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const GENERIC = {
  success: true,
  message: "If an account exists for that email, a reset link has been sent.",
};

exports.forgot = async (req, res) => {
  const { email } = req.validated;

  // Answer first, work afterwards: the response is identical and equally fast
  // whether or not the email exists.
  res.json(GENERIC);

  try {
    const user = await User.findOne({ email, isActive: true }).select("_id name");
    if (!user) return;

    const recent = await PasswordReset.findOne({
      userId: user._id,
      createdAt: { $gt: new Date(Date.now() - COOLDOWN_MS) },
    });
    if (recent) return;

    await PasswordReset.deleteMany({ userId: user._id }); // only the newest link works

    const token = crypto.randomBytes(32).toString("hex");
    await PasswordReset.create({
      userId: user._id,
      tokenHash: sha256(token), // the raw token is never stored
      expiresAt: new Date(Date.now() + TTL_MS),
    });

    const link = `${process.env.CLIENT_ORIGIN}/reset-password?token=${token}`;
    await sendMail({
      to: email,
      subject: "Reset your Meenal School password",
      text:
        `Hi ${user.name},\n\nUse this link to choose a new password (valid for 15 minutes):\n${link}\n\n` +
        `If you did not ask for this, ignore this email. Your password stays the same.`,
      html:
        `<p>Hi ${esc(user.name)},</p>` +
        `<p><a href="${link}" style="background:#8b5cf6;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Reset my password</a></p>` +
        `<p>This link is valid for 15 minutes.</p>` +
        `<p>If you did not ask for this, ignore this email. Your password stays the same.</p>`,
    });
  } catch (err) {
    console.error("Password reset email failed:", err.message);
  }
};

exports.reset = async (req, res) => {
  const { token, newPassword } = req.validated;

  // Find and delete in one step, so a link can only ever be used once
  const record = await PasswordReset.findOneAndDelete({
    tokenHash: sha256(token),
    expiresAt: { $gt: new Date() },
  });
  const invalid = { success: false, message: "This reset link is invalid or has expired." };
  if (!record) return res.status(400).json(invalid);

  const user = await User.findById(record.userId);
  if (!user || !user.isActive) return res.status(400).json(invalid);

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.tokenVersion += 1;      // every existing session dies
  user.failedLoginCount = 0;   // clears any lockout
  user.lockUntil = undefined;
  await user.save();

  await PasswordReset.deleteMany({ userId: user._id });
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  res.json({ success: true, role: user.role });
};