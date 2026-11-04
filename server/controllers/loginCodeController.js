const User = require("../models/User");
const { generateCode, formatCode, hashCode, encryptCode, decryptCode } = require("../utils/loginCode");
const { audit } = require("../utils/audit");
const { notify } = require("../utils/notify");

const MEMBERS = { $in: ["student", "teacher"] };

// Make (or replace) a login code
exports.generate = async (req, res) => {
  const code = generateCode();
  const user = await User.findOneAndUpdate(
    { _id: req.validated.id, role: MEMBERS, isActive: true },
    {
      loginCodeHash: hashCode(code),
      loginCodeEnc: encryptCode(code),
      loginCodeCreatedAt: new Date(),
      $unset: { loginCodeLastUsedAt: 1 },
    },
    { new: true }
  );
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found or inactive." });
  }
  res.json({ success: true, code: formatCode(code) });
};

// Show an existing code again (admin only)
exports.reveal = async (req, res) => {
  const user = await User.findOne({ _id: req.validated.id, role: MEMBERS }).select("+loginCodeEnc name");
  if (!user) return res.status(404).json({ success: false, message: "User not found." });

  if (!user.loginCodeEnc) {
    return res.status(404).json({
      success: false,
      message: "This person has no code that can be viewed. Click “Replace code” (or “Login code”) to make one you can view any time.",
    });
  }

  const code = decryptCode(user.loginCodeEnc);
  if (!code) {
    return res.status(500).json({
      success: false,
      message: "This code cannot be read anymore (the server key changed). Click “Replace code” to make a new one.",
    });
  }

   await audit(req, "logincode.view", {
    targetType: "user",
    targetId: user._id,
    summary: `Viewed the login code of ${user.name}`,
  });
    notify("admins", { type: "logincode.view", title: "Login code viewed", body: `${req.user.name} viewed the login code of ${user.name}.`, email: false, push: false });
  res.json({ success: true, code: formatCode(code) });
};

exports.revoke = async (req, res) => {
  const user = await User.findOneAndUpdate(
    { _id: req.validated.id, role: MEMBERS },
    { $unset: { loginCodeHash: 1, loginCodeEnc: 1, loginCodeCreatedAt: 1, loginCodeLastUsedAt: 1 } }
  );
  if (!user) return res.status(404).json({ success: false, message: "User not found." });
  res.json({ success: true });
};