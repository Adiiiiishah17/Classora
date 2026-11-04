const router = require("express").Router();
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { protect, authorize } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const v = require("../validators/profileValidators");
const photos = require("../utils/photoStorage");
const ctrl = require("../controllers/profileController");
const selfCode = require("../controllers/selfCodeController");

const upload = multer({
  storage: multer.memoryStorage(), // at most 2 MB in memory; it is checked before anything touches the disk
  limits: { fileSize: photos.MAX_BYTES, files: 1, fields: 2, fieldSize: 1000 },
}).single("photo");

// Turns upload problems into normal, readable errors
function receive(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(Object.assign(new Error("The photo is too large. The limit is 2 MB."), { status: 413 }));
    }
    if (err.name === "MulterError") return next(Object.assign(new Error("The upload could not be read."), { status: 400 }));
    next(err);
  });
}

// Limits are per person, not per school Wi-Fi
const perUser = (limit, message) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => req.user.id,
    message: { success: false, message },
  });

const photoLimiter = perUser(20, "Too many photo uploads. Try again later.");
const editLimiter = perUser(40, "Too many changes. Try again later.");
const codeLimiter = perUser(15, "Too many attempts. Try again later.");

// Students and teachers can change different fields
const byRole = (req, res, next) =>
  validate(req.user.role === "student" ? v.updateStudent : v.updateTeacher)(req, res, next);

const member = authorize("student", "teacher");

router.use(protect);

router.get("/me", member, ctrl.me);
router.patch("/me", member, editLimiter, byRole, ctrl.updateMe);

router.post("/photo", member, photoLimiter, receive, ctrl.uploadPhoto);
router.delete("/photo", member, ctrl.removePhoto);
router.get("/photo/:id", validate(v.idParam, "params"), ctrl.photo);

// The person's own login code
router.get("/login-code", member, selfCode.status);
router.post("/login-code", member, codeLimiter, validate(v.passwordBody), selfCode.create);
router.post("/login-code/reveal", member, codeLimiter, validate(v.passwordBody), selfCode.reveal);
router.delete("/login-code", member, selfCode.revoke);

router.get("/tutors", authorize("student"), ctrl.tutors);
router.get("/admin/:id", authorize("admin"), validate(v.idParam, "params"), ctrl.adminView);

module.exports = router;