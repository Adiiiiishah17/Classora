const router = require("express").Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { idParamSchema } = require("../validators/userValidators");
const v = require("../validators/phase4Validators");
const ctrl = require("../controllers/announcementController");

router.use(protect);

router.get("/", ctrl.list); // everyone sees only what is meant for them
router.post("/", authorize("admin", "teacher"), validate(v.createAnnouncementSchema), ctrl.create);
router.put("/:id", authorize("admin", "teacher"), validate(idParamSchema, "params"), validate(v.editAnnouncementSchema), ctrl.update);
router.delete("/:id", authorize("admin", "teacher"), validate(idParamSchema, "params"), ctrl.remove);

module.exports = router;