const mongoose = require("mongoose");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const Attendance = require("../models/Attendance");
const TeacherAttendance = require("../models/TeacherAttendance");
const { todayStr, monthRange } = require("../utils/dates");
const { audit } = require("../utils/audit");
const { emitTo } = require("../sockets");
const { notify } = require("../utils/notify");

const httpError = (message, status) => Object.assign(new Error(message), { status });
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function summarize(counts) {
  const c = { present: 0, absent: 0, late: 0, leave: 0, ...counts };
  const counted = c.present + c.late + c.absent;
  return { ...c, percentage: counted ? Math.round(((c.present + c.late) / counted) * 1000) / 10 : null };
}

async function findPerson(id) {
  const user = await User.findOne({ _id: id, role: { $in: ["student", "teacher"] } })
    .select("name username role isActive")
    .lean();
  if (!user) throw httpError("User not found.", 404);
  return user;
}

// Search by name or username
exports.search = async (req, res) => {
  const { q, role } = req.validated;
  const re = new RegExp(escapeRe(q), "i");
  const users = await User.find({
    role: role || { $in: ["student", "teacher"] },
    $or: [{ name: re }, { username: re }],
  })
    .select("name username role isActive")
    .sort({ name: 1 })
    .limit(20)
    .lean();

  const profiles = await StudentProfile.find({ userId: { $in: users.filter((u) => u.role === "student").map((u) => u._id) } })
    .select("userId className rollNumber")
    .lean();
  const byUser = new Map(profiles.map((p) => [String(p.userId), p]));

  res.json({
    success: true,
    items: users.map((u) => ({
      id: String(u._id),
      name: u.name,
      username: u.username,
      role: u.role,
      isActive: u.isActive,
      className: byUser.get(String(u._id))?.className || "",
    })),
  });
};

// One person's attendance for a month
exports.show = async (req, res) => {
  const { id, month = todayStr().slice(0, 7) } = req.validated;
  const user = await findPerson(id);
    if (req.user.role === "teacher" && user.role !== "student") throw httpError("You do not have access.", 403);
  const { start, end } = monthRange(month);

  const isStudent = user.role === "student";
  const Model = isStudent ? Attendance : TeacherAttendance;
  const key = isStudent ? "studentId" : "teacherId";
  const oid = new mongoose.Types.ObjectId(id);

  const [records, totals] = await Promise.all([
    Model.find({ [key]: oid, date: { $gte: start, $lte: end } }).select("date status").sort({ date: 1 }).lean(),
    Model.aggregate([{ $match: { [key]: oid } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);

  const monthCounts = {};
  for (const r of records) monthCounts[r.status] = (monthCounts[r.status] || 0) + 1;
  const allCounts = {};
  for (const t of totals) allCounts[t._id] = t.n;

  res.json({
    success: true,
    month,
    records,
    monthSummary: summarize(monthCounts),
    overall: summarize(allCounts),
  });
};

// Set one person's status for one date (any past date, admin only)
exports.setDay = async (req, res) => {
  const { id, date, status } = req.validated;
  if (date > todayStr()) throw httpError("You cannot mark attendance for a future date.", 400);
  const user = await findPerson(id);

  let before = null;
  let className = "";

  if (user.role === "student") {
    const [existing, profile] = await Promise.all([
      Attendance.findOne({ studentId: id, date }).select("status className").lean(),
      StudentProfile.findOne({ userId: id }).select("className").lean(),
    ]);
    before = existing?.status || null;
    className = existing?.className || profile?.className || "";

    if (before === status) return res.json({ success: true, changed: false });

    await Attendance.updateOne(
      { studentId: id, date },
      { $set: { className, status, markedBy: req.user.id } },
      { upsert: true }
    );
  } else {
    const existing = await TeacherAttendance.findOne({ teacherId: id, date }).select("status").lean();
    before = existing?.status || null;
    if (before === status) return res.json({ success: true, changed: false });

    await TeacherAttendance.updateOne(
      { teacherId: id, date },
      { $set: { status, markedBy: req.user.id } },
      { upsert: true }
    );
  }

  const prefix = user.role === "student" ? "attendance" : "attendance.teacher";
  await audit(req, `${prefix}.${before ? "edit" : "mark"}`, {
    targetType: "user",
    targetId: id,
    summary: `${user.name}, ${date}: ${before ? `${before} to ${status}` : status}`,
    meta: { date, from: before, to: status },
  });

  emitTo(`user:${id}`, "attendance:marked", { date, status });
  if (user.role === "student") emitTo(["role:admin", "role:teacher"], "attendance:updated", { className, date });
  else emitTo("role:admin", "teacherattendance:updated", { date });
    notify([id], {
    type: "attendance.edit",
    title: "Attendance updated",
    body: `Your attendance for ${date} was set to ${status}.`,
  });
  res.json({ success: true, changed: true });
};