const fs = require("fs");
const { pipeline } = require("stream/promises");
const Doc = require("../models/Document");
const storage = require("../utils/storage");
const gridfs = require("../utils/gridfs");
const v = require("../validators/phase4Validators");
const { visibleFilter, recipientIds, roomsFor } = require("../utils/audience");
const { audit } = require("../utils/audit");
const { notify } = require("../utils/notify");
const { emitTo } = require("../sockets");

const httpError = (message, status) => Object.assign(new Error(message), { status });

// Types that are shown with a strict "no scripts" header when opened in the browser
const LOCKED = new Set(["svg", "txt", "csv"]);
const LOCK_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";

// The browser sends names as latin1 bytes; turn them back into real text and make them safe.
// The extension always comes from the checked file type, never from what the user typed.
function cleanName(raw, ext) {
  let n = Buffer.from(String(raw || ""), "latin1").toString("utf8");
  n = n.replace(/[\\/\u0000-\u001f"]/g, "_").trim();
  n = n.replace(/\.[A-Za-z0-9]{1,5}$/, "").slice(0, 110) || "document";
  return `${n}.${ext}`;
}

exports.list = async (req, res) => {
  const filter = await visibleFilter(req.user);
  const items = await Doc.find(filter).sort({ createdAt: -1 }).limit(100).select("-storedName").lean();
  res.json({
    success: true,
    items: items.map((d) => ({ ...d, ext: d.ext || "pdf", mine: String(d.authorId) === req.user.id })),
  });
};

exports.create = async (req, res) => {
  const file = req.file;
  let fileId = null;
  let doc;
  try {
    if (!file) throw httpError("Choose a file.", 400);

    const parsed = v.createDocumentSchema.safeParse(req.body);
    if (!parsed.success) throw httpError(parsed.error.issues[0].message, 400);
    const d = parsed.data;

    if (req.user.role === "teacher" && !["students", "class"].includes(d.audience)) {
      throw httpError("You can share files with students or with a class.", 403);
    }

    const ext = storage.extOf(file.originalname);
    if (!ext) throw httpError(`This file type is not allowed. You can upload: ${storage.ALLOWED_LABEL}.`, 400);

    const problem = await storage.contentProblem(file.path, ext);
    if (problem) throw httpError(problem, 400);

    const originalName = cleanName(file.originalname, ext);
    fileId = await gridfs.save("documents", fs.createReadStream(file.path), originalName, storage.TYPES[ext].mime);

    doc = await Doc.create({
      title: d.title,
      audience: d.audience,
      className: d.audience === "class" ? d.className : undefined,
      originalName,
      storedName: fileId, // the file's id inside MongoDB
      ext,
      size: file.size,
      authorId: req.user.id,
      authorName: req.user.name,
      authorRole: req.user.role,
    });
  } catch (err) {
    if (fileId) await gridfs.remove("documents", fileId); // never keep a rejected upload
    throw err;
  } finally {
    if (file) await storage.remove(file.filename); // the temporary copy is always deleted
  }

  await audit(req, "document.post", {
    targetType: "document",
    targetId: doc._id,
    summary: `Shared "${doc.title}" (${doc.ext.toUpperCase()}) with ${doc.audience === "class" ? `class ${doc.className}` : doc.audience}`,
  });

  emitTo(roomsFor(doc), "document:changed", {});
  emitTo(roomsFor(doc), "document:new", { title: doc.title, authorId: req.user.id });

  const ids = (await recipientIds(doc)).filter((id) => id !== req.user.id);
  if (ids.length) {
    notify(ids, {
      type: "document",
      title: `📄 ${doc.title}`,
      body: `${req.user.name} shared a new file.`,
      email: false, // keeps the free email limit for important mail
    });
  }

  res.status(201).json({ success: true });
};

// Opens in the browser when the type allows it; ?download=1 always saves it
exports.file = async (req, res) => {
  const { id, download } = req.validated;
  const filter = await visibleFilter(req.user);
  const doc = await Doc.findOne({ $and: [{ _id: id }, filter] }).lean();
  if (!doc) throw httpError("File not found.", 404);

  const stored = await gridfs.info("documents", doc.storedName);
  if (!stored) throw httpError("File not found.", 404);

  const ext = storage.TYPES[doc.ext] ? doc.ext : "pdf";
  const inline = !download && storage.isViewable(ext);
  const ascii = doc.originalName.replace(/[^A-Za-z0-9._-]/g, "_");

  res.set({
    "Content-Type": storage.mimeFor(ext, !inline),
    "Content-Length": String(stored.length),
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    ...(LOCKED.has(ext) ? { "Content-Security-Policy": LOCK_CSP } : {}),
  });

  try {
    await pipeline(gridfs.open("documents", doc.storedName), res);
  } catch {
    if (!res.headersSent) {
      res.removeHeader("Content-Length");
      res.removeHeader("Content-Disposition");
      throw httpError("File not found.", 404);
    }
    res.destroy(); // the download was cut off halfway
  }
};

exports.remove = async (req, res) => {
  const doc = await Doc.findById(req.validated.id);
  if (!doc) throw httpError("File not found.", 404);
  if (req.user.role !== "admin" && String(doc.authorId) !== req.user.id) {
    throw httpError("You can delete only your own files.", 403);
  }

  await doc.deleteOne();
  await gridfs.remove("documents", doc.storedName);

  await audit(req, "document.delete", {
    targetType: "document",
    targetId: doc._id,
    summary: `Deleted the file "${doc.title}"`,
  });
  emitTo(roomsFor(doc), "document:changed", {});
  res.json({ success: true });
};