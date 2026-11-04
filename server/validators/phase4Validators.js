const { objectId } = require("./userValidators");
const { z } = require("zod");
const { isValidDate } = require("../utils/dates");

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine(isValidDate, "That date does not exist");
const monthStr = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use the format YYYY-MM");
const status = z.enum(["present", "absent", "late", "leave"]);

const classNameParams = z.object({ name: z.string().trim().min(1).max(40) });
const dateQuery = z.object({ date: dateStr.optional() });
const monthQuery = z.object({ month: monthStr.optional() });

const saveRegisterSchema = z
  .object({
    date: dateStr,
    records: z.array(z.object({ studentId: objectId, status }).strict()).min(1).max(300),
  })
  .strict();

const teacherRegisterSchema = z
  .object({
    date: dateStr,
    records: z.array(z.object({ teacherId: objectId, status }).strict()).min(1).max(300),
  })
  .strict();

const attendanceRequestSchema = z
  .object({ date: dateStr, note: z.string().trim().min(5, "Please write a short note").max(300) })
  .strict();

const createLeaveSchema = z
  .object({
    fromDate: dateStr,
    toDate: dateStr,
    reason: z.string().trim().min(5, "Please write a short reason").max(500),
  })
  .strict();

const inboxQuery = z.object({
  status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
});

// Approving: the note is optional. Rejecting: a reason is required.
const decisionSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(300).optional(),
  })
  .strict()
  .refine((d) => d.decision === "approve" || !!d.note, {
    message: "Please write a reason for rejecting.",
    path: ["note"],
  });

  const peopleQuery = z.object({
  q: z.string().trim().min(1).max(50),
  role: z.enum(["student", "teacher"]).optional(),
});

const personEditSchema = z.object({ date: dateStr, status }).strict();
const studentRosterSchema = z
  .object({
    date: dateStr,
    records: z.array(z.object({ studentId: objectId, status }).strict()).min(1).max(500),
  })
  .strict();

  // Only the real browser push services are accepted, so the server never calls arbitrary addresses
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)mozilla\.com$/, /(^|\.)windows\.com$/, /(^|\.)apple\.com$/];
const pushEndpoint = z
  .string()
  .max(600)
  .refine((u) => {
    try {
      const x = new URL(u);
      return x.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(x.hostname));
    } catch {
      return false;
    }
  }, "Invalid push address");

const pushSubscriptionSchema = z
  .object({
    endpoint: pushEndpoint,
    expirationTime: z.number().nullable().optional(),
    keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(5).max(100) }).strict(),
  })
  .strict();

const unsubscribeSchema = z.object({ endpoint: z.string().max(600) }).strict();

const createAnnouncementSchema = z
  .object({
    title: z.string().trim().min(3, "Write a short title").max(120),
    body: z.string().trim().min(3, "Write the announcement").max(2000),
    audience: z.enum(["all", "students", "teachers", "class"]),
    className: z.string().trim().min(1).max(40).optional(),
    urgent: z.boolean().optional(),
  })
  .strict()
  .refine((d) => d.audience !== "class" || !!d.className, { message: "Choose a class.", path: ["className"] });

const editAnnouncementSchema = z
  .object({
    title: z.string().trim().min(3, "Write a short title").max(120),
    body: z.string().trim().min(3, "Write the announcement").max(2000),
    urgent: z.boolean().optional(),
  })
  .strict();

  const createDocumentSchema = z
  .object({
    title: z.string().trim().min(3, "Write a short title").max(120),
    audience: z.enum(["all", "students", "teachers", "class"]),
    className: z.string().trim().min(1).max(40).optional(),
  })
  .refine((d) => d.audience !== "class" || !!d.className, { message: "Choose a class.", path: ["className"] });

const documentFileQuery = z.object({ download: z.literal("1").optional() });

module.exports = {
  classNameParams,
  dateQuery,
  monthQuery,
  saveRegisterSchema,
  teacherRegisterSchema,
  attendanceRequestSchema,
  createLeaveSchema,
  inboxQuery,
  decisionSchema,
  peopleQuery,
  personEditSchema,
  studentRosterSchema,
  pushSubscriptionSchema,
  unsubscribeSchema,
  createAnnouncementSchema,
  editAnnouncementSchema,
  createDocumentSchema,
  documentFileQuery,
};