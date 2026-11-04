const router = require("express").Router();
const {
  login,
  adminLogin,
  codeLogin,
  googleLogin,
  me,
  logout,
  changePassword,
} = require("../controllers/authController");
const requests = require("../controllers/requestController");
const pwReset = require("../controllers/passwordResetController");
const { protectAllowTemp } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const {
  changePasswordSchema,
  googleSchema,
  forgotSchema,
  resetSchema,
  codeLoginSchema,
} = require("../validators/authValidators");
const { checkIdentifierSchema, requestAccessSchema } = require("../validators/requestValidators");

// Sign in
router.post("/login", login);                       // students and teachers
router.post("/admin/login", adminLogin);            // admin only
router.post("/code-login", validate(codeLoginSchema), codeLogin);
router.post("/google", validate(googleSchema), googleLogin);

// Registration (public)
router.post("/check-identifier", validate(checkIdentifierSchema), requests.checkIdentifier);
router.post("/request-access", validate(requestAccessSchema), requests.submit);

// Password reset
router.post("/forgot-password", validate(forgotSchema), pwReset.forgot);
router.post("/reset-password", validate(resetSchema), pwReset.reset);

// Signed-in users
router.get("/me", protectAllowTemp, me);
router.post("/logout", logout);
router.post("/change-password", protectAllowTemp, validate(changePasswordSchema), changePassword);

module.exports = router;