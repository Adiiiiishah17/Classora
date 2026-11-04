const router = require("express").Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const v = require("../validators/userValidators");
const rv = require("../validators/requestValidators");
const admin = require("../controllers/adminController");
const requests = require("../controllers/requestController");
const codes = require("../controllers/loginCodeController");

router.use(protect, authorize("admin"));

router.get("/class-groups", admin.listClassGroups);
router.post("/class-groups", validate(v.classBody), admin.addClassGroup);
router.get("/class-groups/:name", validate(v.classParams, "params"), admin.classGroupDetail);
router.get("/batches", admin.listBatches);
router.get("/batches/:name", validate(v.batchParams, "params"), admin.batchDetail);
router.get("/audit", admin.listAudit);

router.get("/students", admin.listStudents);
router.post("/students", validate(v.createStudentSchema), admin.createStudent);

router.get("/teachers", admin.listTeachers);
router.post("/teachers", validate(v.createTeacherSchema), admin.createTeacher);

router.patch("/users/:id/profile", validate(v.idParamSchema, "params"), validate(v.updateProfileSchema), admin.updateProfile);
router.patch("/users/:id/active", validate(v.idParamSchema, "params"), validate(v.activeSchema), admin.setActive);
router.post("/users/:id/reset-password", validate(v.idParamSchema, "params"), admin.resetPassword);

router.get("/users/:id/login-code", validate(v.idParamSchema, "params"), codes.reveal);
router.post("/users/:id/login-code", validate(v.idParamSchema, "params"), codes.generate);
router.delete("/users/:id/login-code", validate(v.idParamSchema, "params"), codes.revoke);

router.get("/requests", validate(rv.requestListQuery, "query"), requests.list);
router.post("/requests/:id/approve", validate(v.idParamSchema, "params"), requests.approve);
router.post("/requests/:id/reject", validate(v.idParamSchema, "params"), requests.reject);

module.exports = router;