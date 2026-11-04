const { z } = require("zod");

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(200)
  .regex(/[A-Z]/, "Add at least one capital letter")
  .regex(/[^A-Za-z0-9\s]/, "Add at least one special character (like ! @ # $)");

// For scripts: returns an error message, or null if the password is fine
function checkPassword(pw) {
  const r = passwordSchema.safeParse(pw);
  return r.success ? null : r.error.issues[0].message;
}

module.exports = { passwordSchema, checkPassword };