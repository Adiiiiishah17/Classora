const router = require("express").Router();
const crypto = require("crypto");
const multer = require("multer");
const { protect, authorize } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { idParamSchema } = require("../validators/userValidators");
const v = require("../validators/phase4Validators");
const storage = require("../utils/storage");
const ctrl = require("../controllers/documentController");

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, storage.DIR),
    // A random temporary name. The controller checks the real content, then gives the file its final name.
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(16).toString("hex")}.part`),
  }),
  limits: { fileSize: storage.MAX_BYTES, files: 1, fields: 5, fieldSize: 2000 },
  fileFilter: (req, file, cb) => {
    const ok = !!storage.extOf(file.originalname);
    cb(
      ok ? null : Object.assign(new Error(`This file type is not allowed. You can upload: ${storage.ALLOWED_LABEL}.`), { status: 400 }),
      ok
    );
  },
}).single("file");

// Turns upload problems into normal, readable errors
function receive(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(Object.assign(new Error(`The file is too large. The limit is ${storage.MAX_MB} MB.`), { status: 413 }));
    }
    if (err.name === "MulterError") return next(Object.assign(new Error("The upload could not be read."), { status: 400 }));
    next(err);
  });
}

router.use(protect);

router.get("/", ctrl.list); // everyone sees only what is meant for them
router.get("/:id/file", validate(idParamSchema, "params"), validate(v.documentFileQuery, "query"), ctrl.file);
router.post("/", authorize("admin", "teacher"), receive, ctrl.create);
router.delete("/:id", authorize("admin", "teacher"), validate(idParamSchema, "params"), ctrl.remove);

module.exports = router;