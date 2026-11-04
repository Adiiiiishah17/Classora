const router = require("express").Router();
const { protect } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { idParamSchema } = require("../validators/userValidators");
const v = require("../validators/phase4Validators");
const ctrl = require("../controllers/notificationController");

router.use(protect); // every signed-in person, own notifications only

router.get("/", ctrl.list);
router.post("/read-all", ctrl.readAll);
router.get("/vapid-key", ctrl.vapidKey);
router.post("/push-subscription", validate(v.pushSubscriptionSchema), ctrl.subscribe);
router.delete("/push-subscription", validate(v.unsubscribeSchema), ctrl.unsubscribe);
router.post("/:id/read", validate(idParamSchema, "params"), ctrl.readOne);

module.exports = router;