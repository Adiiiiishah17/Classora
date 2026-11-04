const { z } = require("zod");
const { normalizePhone } = require("../utils/phone");
const { normalizeSubject, SUBJECT_RE, uniqueList } = require("../utils/subjects");
const { normalizeClass, CLASS_RE } = require("../utils/classes");
const { isValidDate, todayStr } = require("../utils/dates");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const email = z.email().max(254).transform((v) => v.toLowerCase());

const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username needs at least 3 characters")
  .max(30)
  .regex(/^(?=.*[a-z])[a-z0-9._]+$/, "Username needs a letter and can use only letters, numbers, dot and underscore");

const phone = z
  .string()
  .trim()
  .max(20)
  .transform((v) => normalizePhone(v))
  .refine((v) => v !== null, "Enter a valid 10-digit mobile number");

const optionalPhone = z
  .string()
  .trim()
  .max(20)
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number" });
      return z.NEVER;
    }
    return n;
  });

  // Optional date of birth: "YYYY-MM-DD", a real date in the past
const dobOptional = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    if (!isValidDate(v) || v < "1900-01-01" || v > todayStr()) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date of birth (not in the future)" });
      return z.NEVER;
    }
    return v;
  });

const subjectName = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .refine((v) => SUBJECT_RE.test(normalizeSubject(v)), "Subjects can use letters, numbers, spaces and & + . - only")
  .transform(normalizeSubject);

const subjectList = z.array(subjectName).max(20).transform(uniqueList);

// A class typed by a person, e.g. "10-A"
const className = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine((v) => CLASS_RE.test(normalizeClass(v)), "Invalid class name")
  .transform(normalizeClass);

const classList = z.array(className).max(20).transform(uniqueList);

const createStudentSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email,
    username,
    phone,
    dob: dobOptional,
    className: className.optional(),
    rollNumber: z.string().trim().min(1).max(20).optional(), // empty = assigned automatically
    subjects: subjectList.optional(),
    guardianName: z.string().trim().max(100).optional(),
    guardianPhone: optionalPhone,
  })
  .strict();

const createTeacherSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email,
    username,
    phone,
       dob: dobOptional,
    employeeId: z.string().trim().max(30).optional(),
    classNames: classList.optional(),
    subjects: subjectList.refine((a) => a.length > 0, "Enter the subject you teach"),
  })
  .strict();

const updateProfileSchema = z
  .object({
    className: className.nullable().optional(), // students: null removes the class
    classNames: classList.optional(),           // teachers
    subjects: subjectList.optional(),
  })
  .strict();

const batchParams = z.object({ name: subjectName });
const classParams = z.object({ name: className });
const classBody = z.object({ name: className }).strict();
const idParamSchema = z.object({ id: objectId });
const activeSchema = z.object({ isActive: z.boolean() }).strict();

module.exports = {
  objectId,
  email,
  username,
  phone,
  optionalPhone,
  dobOptional,
  subjectName,
  subjectList,
  className,
  classList,
  createStudentSchema,
  createTeacherSchema,
  updateProfileSchema,
  batchParams,
  classParams,
  classBody,
  idParamSchema,
  activeSchema,
};