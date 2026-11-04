const mongoose = require("mongoose");
const StudentProfile = require("../models/StudentProfile");
const Attendance = require("../models/Attendance");
const LeaveRequest = require("../models/LeaveRequest");
const { classesFor } = require("../utils/classAccess");
const { todayStr, daysBetween, monthRange } = require("../utils/dates");
const { audit } = require("../utils/audit");
const { emitTo } = require("../sockets");
const { notifyAttendance } = require("../utils/notify");

const EDIT_WINDOW_DAYS = Number(process.env.ATTENDANCE_EDIT_DAYS || 7);
const httpError = (message, status) => Object.assign(new Error(message), { status });
const byRoll = (a, b) => (a.rollNumber || "").localeCompare(b.rollNumber || "", undefined, { numeric: true });

// Leave days are not counted for or against the student
function summarize(counts) {
  const c = { present: 0, absent: 0, late: 0, leave: 0, ...counts };
  const counted = c.present + c.late + c.absent;
  return { ...c, percentage: counted ? Math.round(((c.present + c.late) / counted) * 1000) / 10 : null };
}

function editState(user, date) {
  const today = todayStr();
  if (date > today) return { ok: false, reason: "You cannot mark attendance for a future date." };
  if (user.role === "teacher" && daysBetween(date, today) > EDIT_WINDOW_DAYS) {
    return { ok: false, reason: `Teachers can change attendance only up to ${EDIT_WINDOW_DAYS} days back. Ask the admin.` };
  }
  return { ok: true, reason: "" };
}

/* ---------------- teachers and admin ---------------- */

exports.myClasses = async (req, res) => {
  res.json({ success: true, classes: await classesFor(req.user) });
};

exports.getRegister = async (req, res) => {
  const { name, date = todayStr() } = req.validated;

  const profiles = await StudentProfile.find({ className: name })
    .populate("userId", "name username phone isActive")
    .lean();
  const students = profiles.filter((p) => p.userId && p.userId.isActive).sort(byRoll);
  const ids = students.map((p) => p.userId._id);

  const [records, leaves] = await Promise.all([
    Attendance.find({ studentId: { $in: ids }, date }).select("studentId status").lean(),
    LeaveRequest.find({
      applicantId: { $in: ids },
      applicantRole: "student",
      status: "approved",
      fromDate: { $lte: date },
      toDate: { $gte: date },
    }).select("applicantId").lean(),
  ]);

  const rec = new Map(records.map((r) => [String(r.studentId), r.status]));
  const onLeave = new Set(leaves.map((l) => String(l.applicantId)));
  const edit = editState(req.user, date);

  res.json({
    success: true,
    className: name,
    date,
    marked: records.length > 0,
    canEdit: edit.ok,
    editNote: edit.reason,
    students: students.map((p) => {
      const id = String(p.userId._id);
      return {
        studentId: id,
        name: p.userId.name,
        username: p.userId.username,
        rollNumber: p.rollNumber || "",
        status: rec.get(id) || null,
        onLeave: onLeave.has(id),
      };
    }),
  });
};

exports.saveRegister = async (req, res) => {
  const { name, date, records } = req.validated;

  const edit = editState(req.user, date);
  if (!edit.ok) throw httpError(edit.reason, 403);

  const ids = records.map((r) => r.studentId);
  if (new Set(ids).size !== ids.length) throw httpError("A student appears twice.", 400);

  // Only students who are really in this class
  const profiles = await StudentProfile.find({ className: name }).select("userId").lean();
  const inClass = new Set(profiles.map((p) => String(p.userId)));
  if (ids.some((id) => !inClass.has(id))) throw httpError("One or more students are not in this class.", 400);

  const existing = await Attendance.find({ studentId: { $in: ids }, date }).select("studentId status").lean();
  const before = new Map(existing.map((e) => [String(e.studentId), e.status]));

  const changed = records.filter((r) => before.get(r.studentId) !== r.status);
  if (!changed.length) return res.json({ success: true, saved: records.length, changed: 0 });

  await Attendance.bulkWrite(
    changed.map((r) => ({
      updateOne: {
        filter: { studentId: r.studentId, date },
        update: { $set: { className: name, status: r.status, markedBy: req.user.id } },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  const edits = changed
    .filter((r) => before.has(r.studentId))
    .map((r) => ({ studentId: r.studentId, from: before.get(r.studentId), to: r.status }));

  await audit(req, edits.length ? "attendance.edit" : "attendance.mark", {
    targetType: "class",
    targetId: name,
    summary: `Class ${name}, ${date}: ${changed.length} saved${edits.length ? `, ${edits.length} changed` : ""}`,
    meta: { date, edits },
  });

  for (const r of changed) emitTo(`user:${r.studentId}`, "attendance:marked", { date, status: r.status });
  emitTo(["role:admin", "role:teacher"], "attendance:updated", { className: name, date });
  notifyAttendance(changed.map((r) => ({ userId: r.studentId, status: r.status })), date);
  res.json({ success: true, saved: records.length, changed: changed.length });
};

exports.classReport = async (req, res) => {
  const { name, month = todayStr().slice(0, 7) } = req.validated;
  const { start, end } = monthRange(month);

  const profiles = await StudentProfile.find({ className: name })
    .populate("userId", "name username isActive")
    .lean();
  const students = profiles.filter((p) => p.userId && p.userId.isActive).sort(byRoll);

  const grouped = await Attendance.aggregate([
    { $match: { studentId: { $in: students.map((p) => p.userId._id) }, date: { $gte: start, $lte: end } } },
    { $group: { _id: { s: "$studentId", st: "$status" }, n: { $sum: 1 } } },
  ]);
  const counts = new Map();
  for (const g of grouped) {
    const key = String(g._id.s);
    counts.set(key, { ...(counts.get(key) || {}), [g._id.st]: g.n });
  }

  res.json({
    success: true,
    month,
    rows: students.map((p) => ({
      studentId: String(p.userId._id),
      name: p.userId.name,
      rollNumber: p.rollNumber || "",
      ...summarize(counts.get(String(p.userId._id))),
    })),
  });
};

/* ---------------- students ---------------- */

// Always about the signed-in student. There is no id in the URL, so nobody can ask for someone else.
exports.myAttendance = async (req, res) => {
  const month = req.validated.month || todayStr().slice(0, 7);
  const { start, end } = monthRange(month);
  const studentId = new mongoose.Types.ObjectId(req.user.id);

  const [records, totals, profile] = await Promise.all([
    Attendance.find({ studentId, date: { $gte: start, $lte: end } }).select("date status").sort({ date: 1 }).lean(),
    Attendance.aggregate([{ $match: { studentId } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    StudentProfile.findOne({ userId: studentId }).select("className rollNumber subjects").lean(),
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
    profile: profile
      ? { className: profile.className || "", rollNumber: profile.rollNumber || "", subjects: profile.subjects || [] }
      : null,
  });
};


/* ---------------- all students: one list for teachers and admin ---------------- */

const byClassThenRoll = (a, b) =>
  (a.className || "").localeCompare(b.className || "", undefined, { numeric: true }) || byRoll(a, b);

exports.listStudents = async (req, res) => {
  const date = req.validated.date || todayStr();

  const profiles = await StudentProfile.find().populate("userId", "name username isActive").lean();
  const students = profiles.filter((p) => p.userId && p.userId.isActive).sort(byClassThenRoll);
  const ids = students.map((p) => p.userId._id);

  const [records, leaves, grouped] = await Promise.all([
    Attendance.find({ studentId: { $in: ids }, date }).select("studentId status").lean(),
    LeaveRequest.find({
      applicantId: { $in: ids },
      applicantRole: "student",
      status: "approved",
      fromDate: { $lte: date },
      toDate: { $gte: date },
    }).select("applicantId").lean(),
    Attendance.aggregate([
      { $match: { studentId: { $in: ids } } },
      { $group: { _id: { s: "$studentId", st: "$status" }, n: { $sum: 1 } } },
    ]),
  ]);

  const rec = new Map(records.map((r) => [String(r.studentId), r.status]));
  const onLeave = new Set(leaves.map((l) => String(l.applicantId)));
  const totals = new Map();
  for (const g of grouped) {
    const k = String(g._id.s);
    totals.set(k, { ...(totals.get(k) || {}), [g._id.st]: g.n });
  }
  const edit = editState(req.user, date);

  res.json({
    success: true,
    date,
    canEdit: edit.ok,
    students: students.map((p) => {
      const id = String(p.userId._id);
      const c = totals.get(id) || {};
      const attended = (c.present || 0) + (c.late || 0);
      return {
        studentId: id,
        name: p.userId.name,
        username: p.userId.username,
        className: p.className || "",
        rollNumber: p.rollNumber || "",
        status: rec.get(id) || null,
        onLeave: onLeave.has(id),
        attended,
        total: attended + (c.absent || 0),
      };
    }),
  });
};

// Only the rows that were changed are sent
exports.saveStudents = async (req, res) => {
  const { date, records } = req.validated;

  const edit = editState(req.user, date);
  if (!edit.ok) throw httpError(edit.reason, 403);

  const ids = records.map((r) => r.studentId);
  if (new Set(ids).size !== ids.length) throw httpError("A student appears twice.", 400);

  const profiles = await StudentProfile.find({ userId: { $in: ids } }).select("userId className").lean();
  if (profiles.length !== ids.length) throw httpError("One or more students were not found.", 400);
  const cls = new Map(profiles.map((p) => [String(p.userId), p.className || ""]));

  const existing = await Attendance.find({ studentId: { $in: ids }, date }).select("studentId status").lean();
  const before = new Map(existing.map((e) => [String(e.studentId), e.status]));

  const changed = records.filter((r) => before.get(r.studentId) !== r.status);
  if (!changed.length) return res.json({ success: true, changed: 0 });

  await Attendance.bulkWrite(
    changed.map((r) => ({
      updateOne: {
        filter: { studentId: r.studentId, date },
        update: { $set: { className: cls.get(r.studentId), status: r.status, markedBy: req.user.id } },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  const edits = changed
    .filter((r) => before.has(r.studentId))
    .map((r) => ({ studentId: r.studentId, from: before.get(r.studentId), to: r.status }));

  await audit(req, edits.length ? "attendance.edit" : "attendance.mark", {
    targetType: "students",
    targetId: date,
    summary: `Students, ${date}: ${changed.length} saved${edits.length ? `, ${edits.length} changed` : ""}`,
    meta: { date, edits },
  });

  for (const r of changed) emitTo(`user:${r.studentId}`, "attendance:marked", { date, status: r.status });
  emitTo(["role:admin", "role:teacher"], "attendance:updated", { date });
    notifyAttendance(changed.map((r) => ({ userId: r.studentId, status: r.status })), date);
  res.json({ success: true, changed: changed.length });
};