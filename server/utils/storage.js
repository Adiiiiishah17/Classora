const fs = require("fs");
const path = require("path");

// Outside any public folder: files are served only through the API after a login check
const DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads", "documents"));
fs.mkdirSync(DIR, { recursive: true });

const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 10);
const MAX_BYTES = MAX_MB * 1024 * 1024;

// path.basename stops names like "../../x" from escaping the folder
const fullPath = (name) => path.join(DIR, path.basename(String(name)));

async function remove(name) {
  try {
    await fs.promises.unlink(fullPath(name));
  } catch (err) {
    if (err.code !== "ENOENT") console.error("Could not delete file:", err.message);
  }
}

async function promote(tempName, finalName) {
  await fs.promises.rename(fullPath(tempName), fullPath(finalName));
}

// What may be uploaded. "view" = the browser may show it instead of downloading it.
const TYPES = {
  pdf: { label: "PDF", mime: "application/pdf", view: true },
  txt: { label: "text", mime: "text/plain; charset=utf-8", view: true },
  csv: { label: "CSV", mime: "text/csv; charset=utf-8", viewMime: "text/plain; charset=utf-8", view: true },
  jpg: { label: "JPG", mime: "image/jpeg", view: true },
  png: { label: "PNG", mime: "image/png", view: true },
  svg: { label: "SVG", mime: "image/svg+xml", view: true },
  docx: { label: "Word", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", view: false },
  pptx: { label: "PowerPoint", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", view: false },
};
const ALLOWED_LABEL = "PDF, TXT, DOCX, PPTX, CSV, JPG, PNG, SVG";

// The extension decides which check runs; the check then looks at the real content
function extOf(name) {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(String(name || ""));
  if (!m) return null;
  const e = m[1].toLowerCase();
  const ext = e === "jpeg" ? "jpg" : e;
  return Object.hasOwn(TYPES, ext) ? ext : null;
}

const isViewable = (ext) => !!TYPES[ext]?.view;
const mimeFor = (ext, asDownload) => (!asDownload && TYPES[ext]?.viewMime) || TYPES[ext]?.mime || "application/octet-stream";

const SIG_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DANGEROUS_SVG = /<script|<foreignObject|<iframe|<embed|<object|<!ENTITY|javascript:|\son[a-z]+\s*=/i;
const isZip = (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

function textProblem(buf) {
  if ((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff)) {
    return "Save this text file as UTF-8 and try again.";
  }
  if (buf.includes(0)) return "This looks like a binary file, not a text file.";
  return "";
}

// Returns "" when the file really is what its name says, otherwise a message for the user
async function contentProblem(filePath, ext) {
  const buf = await fs.promises.readFile(filePath); // at most 10 MB
  if (!buf.length) return "This file is empty.";
  const bad = `This file does not look like a real ${TYPES[ext].label} file.`;

  switch (ext) {
    case "pdf": return buf.subarray(0, 5).toString("latin1") === "%PDF-" ? "" : bad;
    case "png": return buf.subarray(0, 8).equals(SIG_PNG) ? "" : bad;
    case "jpg": return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff ? "" : bad;
    case "docx": return isZip(buf) && buf.includes("word/document.xml") ? "" : bad;
    case "pptx": return isZip(buf) && buf.includes("ppt/presentation.xml") ? "" : bad;
    case "txt":
    case "csv": return textProblem(buf);
    case "svg": {
      const t = textProblem(buf);
      if (t) return t;
      const s = buf.toString("utf8");
      if (!/<svg[\s>]/i.test(s)) return bad;
      if (DANGEROUS_SVG.test(s)) return "This SVG contains scripts or embedded code, which is not allowed.";
      return "";
    }
    default: return bad;
  }
}

// Kept for older code that may still import it
async function isPdf(filePath) {
  const fh = await fs.promises.open(filePath, "r");
  try {
    const buf = Buffer.alloc(5);
    await fh.read(buf, 0, 5, 0);
    return buf.toString("latin1") === "%PDF-";
  } finally {
    await fh.close();
  }
}

module.exports = {
  DIR, MAX_MB, MAX_BYTES, fullPath, remove, promote, isPdf,
  TYPES, ALLOWED_LABEL, extOf, isViewable, mimeFor, contentProblem,
};