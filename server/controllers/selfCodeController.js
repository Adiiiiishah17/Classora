const User = require("../models/User");
const { generateCode, formatCode, hashCode, encryptCode, decryptCode } = require("../utils/loginCode");
const { verifyPassword } = require("../utils/password");
const { audit } = require("../utils/audit");

const httpError = (message, status) => Object.assign(new Error(message), { status });

// Accounts that have a password must type it again. Accounts without one (Google or code sign-in) skip this.
async function requirePassword(userId, plain) {
  const u = await User.findById(userId).select("+passwordHash");
  if (u?.passwordHash && (!plain || !(await verifyPassword(plain, u.passwordHash)))) {
    throw httpError("Your password is not correct.", 400);
  }
}

exports.status = async (req, res) => {
  const u = await User.findById(req.user.id)
    .select("loginCodeCreatedAt loginCodeLastUsedAt +passwordHash")
    .lean();
  res.json({
    success: true,
    hasCode: !!u?.loginCodeCreatedAt,
    createdAt: u?.loginCodeCreatedAt || null,
    lastUsedAt: u?.loginCodeLastUsedAt || null,
    hasPassword: !!u?.passwordHash,
  });
};

// Makes a new code, or replaces the old one (the old one stops working at once)
exports.create = async (req, res) => {
  await requirePassword(req.user.id, req.validated.currentPassword);

  const code = generateCode();
  await User.updateOne(
    { _id: req.user.id },
    {
      loginCodeHash: hashCode(code),
      loginCodeEnc: encryptCode(code),
      loginCodeCreatedAt: new Date(),
      $unset: { loginCodeLastUsedAt: 1 },
    }
  );
  await audit(req, "mylogincode.create", {
    targetType: "user",
    targetId: req.user.id,
    summary: `${req.user.name} (${req.user.role}) made a new login code`,
  });
  res.json({ success: true, code: formatCode(code) });
};

exports.reveal = async (req, res) => {
  await requirePassword(req.user.id, req.validated.currentPassword);

  const u = await User.findById(req.user.id).select("+loginCodeEnc");
  if (!u?.loginCodeEnc) throw httpError("You do not have a login code yet. Make one first.", 404);

  const code = decryptCode(u.loginCodeEnc);
  if (!code) throw httpError("This code cannot be read anymore. Make a new one.", 500);

  await audit(req, "mylogincode.view", {
    targetType: "user",
    targetId: req.user.id,
    summary: `${req.user.name} (${req.user.role}) viewed their own login code`,
  });
  res.json({ success: true, code: formatCode(code) });
};

exports.revoke = async (req, res) => {
  await User.updateOne(
    { _id: req.user.id },
    { $unset: { loginCodeHash: 1, loginCodeEnc: 1, loginCodeCreatedAt: 1, loginCodeLastUsedAt: 1 } }
  );
  await audit(req, "mylogincode.revoke", {
    targetType: "user",
    targetId: req.user.id,
    summary: `${req.user.name} (${req.user.role}) removed their login code`,
  });
  res.json({ success: true });
};