const router = require("express").Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { idParamSchema } = require("../validators/userValidators");
const v = require("../validators/phase4Validators");
const ctrl = require("../controllers/attendanceController");
const tctrl = require("../controllers/teacherAttendanceController");
const pctrl = require("../controllers/personAttendanceController");

router.use(protect);

// Students: their own attendance only
router.get("/me", authorize("student"), validate(v.monthQuery, "query"), ctrl.myAttendance);

// Teachers and admin: student registers
router.get("/classes", authorize("teacher", "admin"), ctrl.myClasses);
router.get(
  "/class/:name",
  authorize("teacher", "admin"),
  validate(v.classNameParams, "params"),
  validate(v.dateQuery, "query"),
  ctrl.getRegister
);
router.put(
  "/class/:name",
  authorize("teacher", "admin"),
  validate(v.classNameParams, "params"),
  validate(v.saveRegisterSchema),
  ctrl.saveRegister
);
router.get(
  "/class/:name/report",
  authorize("teacher", "admin"),
  validate(v.classNameParams, "params"),
  validate(v.monthQuery, "query"),
  ctrl.classReport
);

// Teacher attendance: only the admin marks it. A teacher sees only their own.
router.get("/teachers", authorize("admin"), validate(v.dateQuery, "query"), tctrl.getRegister);
router.put("/teachers", authorize("admin"), validate(v.teacherRegisterSchema), tctrl.saveRegister);
router.get("/teachers/me", authorize("teacher"), validate(v.monthQuery, "query"), tctrl.mine);

// A teacher asks the admin to fix a missed day
router.post("/requests", authorize("teacher"), validate(v.attendanceRequestSchema), tctrl.createRequest);
router.get("/requests/mine", authorize("teacher"), tctrl.myRequests);
router.get("/requests/inbox", authorize("admin"), validate(v.inboxQuery, "query"), tctrl.inbox);
router.post("/requests/:id/cancel", authorize("teacher"), validate(idParamSchema, "params"), tctrl.cancelRequest);
router.post(
  "/requests/:id/decision",
  authorize("admin"),
  validate(idParamSchema, "params"),
  validate(v.decisionSchema),
  tctrl.decide
);

// Admin: find a student or teacher and edit any date
router.get("/people", authorize("admin"), validate(v.peopleQuery, "query"), pctrl.search);
router.get("/person/:id", authorize("teacher", "admin"), validate(idParamSchema, "params"), validate(v.monthQuery, "query"), pctrl.show);
router.put("/person/:id", authorize("admin"), validate(idParamSchema, "params"), validate(v.personEditSchema), pctrl.setDay);
// One list of all students, for teachers and admin
router.get("/roster/students", authorize("teacher", "admin"), validate(v.dateQuery, "query"), ctrl.listStudents);
router.put("/roster/students", authorize("teacher", "admin"), validate(v.studentRosterSchema), ctrl.saveStudents);
module.exports = router;