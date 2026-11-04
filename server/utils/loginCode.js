const crypto = require("crypto");

// 32 characters, no I, O, 0, 1 (easy to read and type). 16 chars = 80 bits of randomness.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LENGTH = 16;

function generateCode() {
  let code = "";
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return code;
}

const formatCode = (code) => code.match(/.{1,4}/g).join("-");

// Accepts "abcd-efgh ..." in any case; returns the clean 16 characters or null
function normalizeCode(input) {
  const c = String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.length !== LENGTH) return null;
  for (const ch of c) if (!ALPHABET.includes(ch)) return null;
  return c;
}

// The hash is what sign-in compares against
const hashCode = (code) => crypto.createHash("sha256").update(code).digest("hex");

/* ---- encryption, so the admin can view a code again ---- */
function key() {
  const raw = process.env.LOGIN_CODE_KEY;
  if (raw && /^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  return Buffer.from(
    crypto.hkdfSync("sha256", process.env.JWT_SECRET, "meenal-login-code-salt", "login-code-encryption", 32)
  );
}

function encryptCode(code) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64url")).join(".");
}

function decryptCode(stored) {
  try {
    const [iv, tag, enc] = String(stored).split(".").map((x) => Buffer.from(x, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null; // wrong key or damaged data
  }
}

module.exports = { generateCode, formatCode, normalizeCode, hashCode, encryptCode, decryptCode };