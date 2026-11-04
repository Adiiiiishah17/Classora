const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { hashPassword, verifyPassword } = require("../utils/password");
const { normalizePhone } = require("../utils/phone");
const { normalizeCode, hashCode } = require("../utils/loginCode");

const COOKIE_NAME = "accessToken";
const isProd = process.env.NODE_ENV === "production";
const MAX_FAILED = isProd ? 5 : 50;
const LOCK_MS = isProd ? 15 * 60 * 1000 : 30 * 1000;

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Same bcrypt time even when the account does not exist (prevents timing leaks)
const dummyHashPromise = hashPassword(crypto.randomBytes(16).toString("hex"));

const cookieOptions = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: "lax",
  path: "/",
});

function createToken(user) {
  return jwt.sign({ sub: user._id.toString(), tv: user.tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: "1h",
    issuer: "school-management-api",
    audience: "school-management-client",
  });
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: 60 * 60 * 1000 });
}

const publicUser = (u) => ({
  id: u._id ?? u.id,
  name: u.name,
  email: u.email,
  username: u.username,
  role: u.role,
  mustChangePassword: !!u.mustChangePassword,
});

const INVALID = { success: false, message: "Invalid email or password." };

// Email, username or phone number
function identifierQuery(raw) {
  const id = raw.trim().toLowerCase();
  const or = [{ email: id }, { username: id }];
  const phone = normalizePhone(id);
  if (phone) or.push({ phone });
  return { $or: or };
}

function makeLogin(allowedRoles) {
  return async function loginHandler(req, res) {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({ success: false, message: "Enter your email, username or phone, and password." });
    }

    const user = await User.findOne(identifierQuery(email)).select("+passwordHash");

    if (user?.lockUntil && user.lockUntil > new Date()) {
      return res.status(429).json({ success: false, message: "Too many failed attempts. Try again in a few minutes." });
    }

    const ok = await verifyPassword(password, user?.passwordHash || (await dummyHashPromise));

    if (!user || !user.passwordHash || !ok) {
      if (user) {
        const updated = await User.findByIdAndUpdate(user._id, { $inc: { failedLoginCount: 1 } }, { new: true });
        if (updated.failedLoginCount >= MAX_FAILED) {
          await User.updateOne(
            { _id: user._id },
            { lockUntil: new Date(Date.now() + LOCK_MS), failedLoginCount: 0 }
          );
        }
      }
      return res.status(401).json(INVALID);
    }

    // Right password but wrong portal: same generic answer
    if (!allowedRoles.includes(user.role)) return res.status(401).json(INVALID);

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "This account is inactive." });
    }

    await User.updateOne(
      { _id: user._id },
      { failedLoginCount: 0, $unset: { lockUntil: 1 }, lastLoginAt: new Date() }
    );

    setAuthCookie(res, createToken(user));
    res.json({ success: true, user: publicUser(user) });
  };
}

const login = makeLogin(["student", "teacher"]);
const adminLogin = makeLogin(["admin"]);

// Sign in with the QR / unique code the admin created (students and teachers only)
async function codeLogin(req, res) {
  const invalid = { success: false, message: "Invalid or revoked login code." };

  const code = normalizeCode(req.validated.code);
  if (!code) return res.status(401).json(invalid);

  const user = await User.findOne({ loginCodeHash: hashCode(code) });
  if (!user || !["student", "teacher"].includes(user.role)) return res.status(401).json(invalid);

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: "This account is inactive." });
  }

  const now = new Date();
  const update = { $set: { lastLoginAt: now, loginCodeLastUsedAt: now } };
  if (user.mustChangePassword) {
    // The code proves who they are, so the temporary password is removed
    update.$set.mustChangePassword = false;
    update.$unset = { passwordHash: 1 };
    user.mustChangePassword = false;
  }
  await User.updateOne({ _id: user._id }, update);

  setAuthCookie(res, createToken(user));
  res.json({ success: true, user: publicUser(user) });
}

// Google sign-in is for students and teachers only
async function googleLogin(req, res) {
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: req.validated.credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ success: false, message: "Google sign-in failed." });
  }

  if (!payload?.email_verified) {
    return res.status(401).json({ success: false, message: "Google email is not verified." });
  }

  const user = await User.findOne({
    $or: [{ googleId: payload.sub }, { email: payload.email.toLowerCase() }],
  });
  if (!user || user.role === "admin") {
    return res.status(403).json({
      success: false,
      message: "No school account for this Google email. Request one first.",
    });
  }
  if (!user.isActive) {
    return res.status(403).json({ success: false, message: "This account is inactive." });
  }
  if (user.googleId && user.googleId !== payload.sub) {
    return res.status(401).json({ success: false, message: "Google sign-in failed." });
  }

  const update = { $set: { googleId: payload.sub, lastLoginAt: new Date() } };
  if (user.mustChangePassword) {
    update.$set.mustChangePassword = false;
    update.$unset = { passwordHash: 1 };
    user.mustChangePassword = false;
  }
  await User.updateOne({ _id: user._id }, update);

  setAuthCookie(res, createToken(user));
  res.json({ success: true, user: publicUser(user) });
}

async function me(req, res) {
  res.json({ success: true, user: publicUser(req.user) });
}

function logout(req, res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ success: true, message: "Logged out successfully." });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.validated;
  const user = await User.findById(req.user.id).select("+passwordHash");

  if (!user || !user.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return res.status(400).json({ success: false, message: "Current password is incorrect." });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ success: false, message: "Choose a different password." });
  }

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.tokenVersion += 1;
  await user.save();

  setAuthCookie(res, createToken(user));
  res.json({ success: true, user: publicUser(user) });
}

module.exports = { login, adminLogin, codeLogin, googleLogin, me, logout, changePassword };