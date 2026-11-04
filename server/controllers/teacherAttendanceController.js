const mongoose = require("mongoose");
const User = require("../models/User");
const TeacherAttendance = require("../models/TeacherAttendance");
const AttendanceRequest = require("../models/AttendanceRequest");
const LeaveRequest = require("../models/LeaveRequest");
const { todayStr, daysBetween, monthRange } = require("../utils/dates");
const { audit } = require("../utils/audit");
const { emitTo } = require("../sockets");
const { notify, notifyAttendance } = require("../utils/notify");

const REQUEST_DAYS = 30;
const httpError = (message, status) => Object.assign(new Error(message), { status });

function summarize(counts) {
  const c = { present: 0, absent: 0, late: 0, leave: 0, ...counts };
  const counted = c.present + c.late + c.absent;
  return { ...c, percentage: counted ? Math.round(((c.present + c.late) / counted) * 1000) / 10 : null };
}

/* ---------------- admin: the teachers' register ---------------- */

exports.getRegister = async (req, res) => {
  const date = req.validated.date || todayStr();
  const teachers = await User.find({ role: "teacher", isActive: true }).select("name username").sort({ name: 1 }).lean();
  const ids = teachers.map((t) => t._id);

  const [records, leaves, grouped] = await Promise.all([
    TeacherAttendance.find({ teacherId: { $in: ids }, date }).select("teacherId status").lean(),
    LeaveRequest.find({
      applicantId: { $in: ids },
      applicantRole: "teacher",
      status: "approved",
      fromDate: { $lte: date },
      toDate: { $gte: date },
    }).select("applicantId").lean(),
    TeacherAttendance.aggregate([
      { $match: { teacherId: { $in: ids } } },
      { $group: { _id: { t: "$teacherId", st: "$status" }, n: { $sum: 1 } } },
    ]),
  ]);

  const rec = new Map(records.map((r) => [String(r.teacherId), r.status]));
  const onLeave = new Set(leaves.map((l) => String(l.applicantId)));
  const totals = new Map();
  for (const g of grouped) {
    const k = String(g._id.t);
    totals.set(k, { ...(totals.get(k) || {}), [g._id.st]: g.n });
  }
  const future = date > todayStr();

  res.json({
    success: true,
    date,
    canEdit: !future,
    teachers: teachers.map((t) => {
      const id = String(t._id);
      const c = totals.get(id) || {};
      const attended = (c.present || 0) + (c.late || 0);
      return {
        teacherId: id,
        name: t.name,
        username: t.username,
        status: rec.get(id) || null,
        onLeave: onLeave.has(id),
        attended,
        total: attended + (c.absent || 0),
      };
    }),
  });
};

exports.saveRegister = async (req, res) => {
  const { date, records } = req.validated;
  if (date > todayStr()) throw httpError("You cannot mark attendance for a future date.", 400);

  const ids = records.map((r) => r.teacherId);
  if (new Set(ids).size !== ids.length) throw httpError("A teacher appears twice.", 400);
  const found = await User.countDocuments({ _id: { $in: ids }, role: "teacher" });
  if (found !== ids.length) throw httpError("One or more people are not teachers.", 400);

  const existing = await TeacherAttendance.find({ teacherId: { $in: ids }, date }).select("teacherId status").lean();
  const before = new Map(existing.map((e) => [String(e.teacherId), e.status]));
  const changed = records.filter((r) => before.get(r.teacherId) !== r.status);
  if (!changed.length) return res.json({ success: true, saved: records.length, changed: 0 });

  await TeacherAttendance.bulkWrite(
    changed.map((r) => ({
      updateOne: {
        filter: { teacherId: r.teacherId, date },
        update: { $set: { status: r.status, markedBy: req.user.id } },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  const edits = changed
    .filter((r) => before.has(r.teacherId))
    .map((r) => ({ teacherId: r.teacherId, from: before.get(r.teacherId), to: r.status }));

  await audit(req, edits.length ? "attendance.teacher.edit" : "attendance.teacher.mark", {
    targetType: "teacherAttendance",
    targetId: date,
    summary: `Teachers, ${date}: ${changed.length} saved${edits.length ? `, ${edits.length} changed` : ""}`,
    meta: { date, edits },
  });

  for (const r of changed) emitTo(`user:${r.teacherId}`, "attendance:marked", { date, status: r.status });
  emitTo("role:admin", "teacherattendance:updated", { date });
    notifyAttendance(changed.map((r) => ({ userId: r.teacherId, status: r.status })), date);
  res.json({ success: true, saved: records.length, changed: changed.length });
};

/* ---------------- teacher: own attendance ---------------- */

exports.mine = async (req, res) => {
  const month = req.validated.month || todayStr().slice(0, 7);
  const { start, end } = monthRange(month);
  const teacherId = new mongoose.Types.ObjectId(req.user.id);

  const [records, totals] = await Promise.all([
    TeacherAttendance.find({ teacherId, date: { $gte: start, $lte: end } }).select("date status").sort({ date: 1 }).lean(),
    TeacherAttendance.aggregate([{ $match: { teacherId } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
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
    profile: null,
  });
};

/* ---------------- teacher: request to the admin ---------------- */

exports.createRequest = async (req, res) => {
  const { date, note } = req.validated;
  const today = todayStr();
  if (date > today) throw httpError("You can send a request only for today or an earlier day.", 400);
  if (daysBetween(date, today) > REQUEST_DAYS) throw httpError(`You can ask only up to ${REQUEST_DAYS} days back.`, 400);

  const mark = await TeacherAttendance.findOne({ teacherId: req.user.id, date }).select("status").lean();
  if (mark?.status === "present") throw httpError("You are already marked present on this day.", 409);

  const dup = await AttendanceRequest.exists({ teacherId: req.user.id, date, status: "pending" });
  if (dup) throw httpError("You already have a pending request for this day.", 409);

  await AttendanceRequest.create({ teacherId: req.user.id, date, note });
  emitTo("role:admin", "attreq:new", {});
    notify("admins", { type: "attreq.new", title: "Attendance request", body: `${req.user.name} asked to be marked present on ${date}.` });
  res.status(201).json({ success: true });
};

exports.myRequests = async (req, res) => {
  const items = await AttendanceRequest.find({ teacherId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("decidedBy", "name")
    .lean();
  res.json({ success: true, items });
};

exports.cancelRequest = async (req, res) => {
  const r = await AttendanceRequest.findOneAndUpdate(
    { _id: req.validated.id, teacherId: req.user.id, status: "pending" },
    { status: "cancelled" }
  );
  if (!r) throw httpError("This request can no longer be cancelled.", 404);
  emitTo("role:admin", "attreq:handled", { id: String(r._id) });
  res.json({ success: true });
};

/* ---------------- admin: decide ---------------- */

exports.inbox = async (req, res) => {
  const { status } = req.validated;
  const filter = status === "all" ? {} : { status };
  const items = await AttendanceRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("teacherId", "name username")
    .populate("decidedBy", "name")
    .lean();

  const rows = items.filter((i) => i.teacherId);
  const marks = rows.length
    ? await TeacherAttendance.find({ $or: rows.map((i) => ({ teacherId: i.teacherId._id, date: i.date })) })
        .select("teacherId date status")
        .lean()
    : [];
  const cur = new Map(marks.map((m) => [`${m.teacherId}|${m.date}`, m.status]));

  res.json({
    success: true,
    items: rows.map((i) => ({ ...i, current: cur.get(`${i.teacherId._id}|${i.date}`) || null })),
  });
};

exports.decide = async (req, res) => {
  const { id, decision, note } = req.validated;

  // Only one decision can win, even if two clicks arrive together
  const updated = await AttendanceRequest.findOneAndUpdate(
    { _id: id, status: "pending" },
    {
      status: decision === "approve" ? "approved" : "rejected",
      decidedBy: req.user.id,
      decidedAt: new Date(),
      decisionNote: note || "",
    },
    { new: true }
  );
  if (!updated) throw httpError("This request was already handled or does not exist.", 409);

  if (decision === "approve") {
    await TeacherAttendance.updateOne(
      { teacherId: updated.teacherId, date: updated.date },
      { $set: { status: "present", markedBy: req.user.id } },
      { upsert: true }
    );
    emitTo(`user:${updated.teacherId}`, "attendance:marked", { date: updated.date, status: "present" });
    
  }

  await audit(req, `attreq.${decision}`, {
    targetType: "attendanceRequest",
    targetId: id,
    summary: `${decision === "approve" ? "Approved" : "Rejected"} a teacher's attendance request for ${updated.date}`,
    meta: { teacherId: String(updated.teacherId), note: note || "" },
  });

  emitTo(`user:${updated.teacherId}`, "attreq:decided", { id: String(id), status: updated.status });
  emitTo("role:admin", "attreq:handled", { id: String(id) });
    notify([updated.teacherId], {
    type: `attreq.${decision}`,
    title: `Attendance request ${updated.status}`,
    body: `Your request for ${updated.date} was ${updated.status}.${note ? ` Note: ${note}` : ""}`,
  });
  res.json({ success: true });
};