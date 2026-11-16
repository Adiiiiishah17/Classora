const { Readable } = require("stream");
const gridfs = require("./gridfs");

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const NAME_RE = /^[a-f0-9]{24}$/;   // a photo's id inside MongoDB
const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

// The real type comes from the first bytes of the file, never from the name or the browser
function detectType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp" };
  return null;
}

const mimeFor = (ext) => MIME[ext] || "application/octet-stream";

const save = (buf, ext) => gridfs.save("photos", Readable.from(buf), `photo.${ext}`, mimeFor(ext));
const remove = (id) => gridfs.remove("photos", id);
const info = (id) => gridfs.info("photos", id);
const open = (id) => gridfs.open("photos", id);

module.exports = { MAX_BYTES, NAME_RE, detectType, mimeFor, save, remove, info, open };