const { z } = require("zod");
const { username, phone, subjectList, className, classList, dobOptional } = require("./userValidators");
const { passwordSchema } = require("./passwordPolicy");

const checkIdentifierSchema = z
  .object({ identifier: z.string().trim().toLowerCase().min(3).max(254) })
  .strict();

const requestAccessSchema = z
  .object({
    role: z.enum(["student", "teacher"]),
    name: z.string().trim().min(2, "Enter your full name").max(100),
    email: z.email().max(254).transform((v) => v.toLowerCase()),
    username,
    phone,
    dob: dobOptional,
    password: passwordSchema,
    className: className.optional(),     // students
    classNames: classList.optional(),    // teachers
    subjects: subjectList.optional(),
    message: z.string().trim().max(300).optional(),
    website: z.string().max(0).optional(), // hidden bot trap: real people leave it empty
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.role === "teacher" && !(d.subjects && d.subjects.length)) {
      ctx.addIssue({ code: "custom", path: ["subjects"], message: "Enter the subject you teach" });
    }
  });

const requestListQuery = z.object({
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

module.exports = { checkIdentifierSchema, requestAccessSchema, requestListQuery };