const { z } = require("zod");
const { passwordSchema } = require("./passwordPolicy");

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: passwordSchema,
  })
  .strict();

const googleSchema = z.object({ credential: z.string().min(20).max(4096) }).strict();

const forgotSchema = z
  .object({ email: z.email().max(254).transform((v) => v.toLowerCase()) })
  .strict();

const resetSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/, "Invalid link"),
    newPassword: passwordSchema,
  })
  .strict();

const codeLoginSchema = z.object({ code: z.string().min(8).max(40) }).strict();

module.exports = { changePasswordSchema, googleSchema, forgotSchema, resetSchema, codeLoginSchema };