const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

// Set PHOTO_DIR in .env to keep photos on a persistent disk when you deploy
const DIR = path.resolve(process.env.PHOTO_DIR || path.join(__dirname, "..", "uploads", "photos"));
fs.mkdirSync(DIR, { recursive: true });

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const NAME_RE = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

// The real type comes from the first bytes of the file, never from the name or the browser
function detectType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp" };
  return null;
}

const mimeFor = (name) => MIME[name.split(".").pop()] || "application/octet-stream";

async function write(name, buf) {
  await fsp.writeFile(path.join(DIR, name), buf, { flag: "wx", mode: 0o600 });
}

async function remove(name) {
  if (!name || !NAME_RE.test(name)) return;
  await fsp.unlink(path.join(DIR, name)).catch(() => {});
}

module.exports = { DIR, MAX_BYTES, NAME_RE, detectType, mimeFor, write, remove };