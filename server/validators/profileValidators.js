const { z } = require("zod");
const { normalizePhone } = require("../utils/phone");
const { isValidDate, todayStr } = require("../utils/dates");
const { email, username, phone, className, classList, subjectList } = require("./userValidators");

const idParam = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id") });

// Optional mobile number: an empty value clears it
const optionalMobile = z.string().trim().max(20).transform((v, ctx) => {
  if (v === "") return "";
  const n = normalizePhone(v);
  if (!n) {
    ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number" });
    return z.NEVER;
  }
  return n;
});

// "YYYY-MM-DD", a real date in the past. An empty value clears it.
const dob = z.string().trim().refine(
  (v) => v === "" || (isValidDate(v) && v >= "1900-01-01" && v <= todayStr()),
  "Enter a valid date of birth (not in the future)"
);

const currentPassword = z.string().min(1).max(200);
const notEmpty = (o) => Object.keys(o).length > 0;

// Only these fields can ever be changed. Anything else (role, roll number, employee ID...) is rejected.
const updateStudent = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    username: username.optional(),
    email: email.optional(),
    phone: phone.optional(),
    dob: dob.optional(),
    currentPassword: currentPassword.optional(), // needed only when the email changes
    className: className.nullable().optional(),  // null removes the class
    subjects: subjectList.optional(),
    guardianName: z.string().trim().max(100).optional(),
    guardianPhone: optionalMobile.optional(),
  })
  .strict()
  .refine(notEmpty, "Nothing to update");

const updateTeacher = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    username: username.optional(),
    email: email.optional(),
    phone: phone.optional(),
    dob: dob.optional(),
    currentPassword: currentPassword.optional(),
    classNames: classList.optional(),
    subjects: subjectList.refine((a) => a.length > 0, "Enter the subject you teach").optional(),
    bio: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine(notEmpty, "Nothing to update");

// For the person's own login code (the password is optional because some accounts have none)
const passwordBody = z.object({ currentPassword: z.string().max(200).optional() }).strict();

module.exports = { idParam, updateStudent, updateTeacher, passwordBody };