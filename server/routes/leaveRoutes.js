const router = require("express").Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { idParamSchema } = require("../validators/userValidators");
const v = require("../validators/phase4Validators");
const ctrl = require("../controllers/leaveController");

router.use(protect);

// Students and teachers apply for their own leave
router.post("/", authorize("student", "teacher"), validate(v.createLeaveSchema), ctrl.create);
router.get("/mine", authorize("student", "teacher"), ctrl.mine);
router.post("/:id/cancel", authorize("student", "teacher"), validate(idParamSchema, "params"), ctrl.cancel);

// Only the admin decides
router.get("/inbox", authorize("admin"), validate(v.inboxQuery, "query"), ctrl.inbox);
router.post(
  "/:id/decision",
  authorize("admin"),
  validate(idParamSchema, "params"),
  validate(v.decisionSchema),
  ctrl.decide
);

module.exports = router;