const userService = require("../services/userService");
const User = require("../models/User");
const Subject = require("../models/Subject");
const StudentProfile = require("../models/StudentProfile");
const TeacherProfile = require("../models/TeacherProfile");
const ClassGroup = require("../models/ClassGroup");
const AuditLog = require("../models/AuditLog");
const { audit } = require("../utils/audit");
const { disconnectUser, refreshRooms } = require("../sockets");
const { notify } = require("../utils/notify");

const USER_FIELDS = "name email username phone isActive loginCodeCreatedAt loginCodeLastUsedAt";
const LIST_FIELDS = `${USER_FIELDS} photoName photoUpdatedAt`; // lists also need to know about photos
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
const byRoll = (a, b) => (a.rollNumber || "").localeCompare(b.rollNumber || "", undefined, { numeric: true });

// The stored file name stays on the server. The browser only learns "has a photo" and a version number.
function withPhoto(u) {
  const { photoName, photoUpdatedAt, ...rest } = u;
  return { ...rest, hasPhoto: !!photoName, photoV: photoUpdatedAt ? new Date(photoUpdatedAt).getTime() : 0 };
}

exports.createStudent = async (req, res) => {
  res.status(201).json({ success: true, ...(await userService.createStudent(req.validated)) });
};

// Lists every student account. A missing profile no longer hides the person.
exports.listStudents = async (req, res) => {
  const users = await User.find({ role: "student" }).select(LIST_FIELDS).sort({ createdAt: -1 }).limit(300).lean();
  const profiles = await StudentProfile.find({ userId: { $in: users.map((u) => u._id) } }).lean();
  const byUser = new Map(profiles.map((p) => [String(p.userId), p]));

  const students = users.map((u) => {
    const p = byUser.get(String(u._id));
    return {
      _id: p?._id || u._id,
      userId: withPhoto(u),
      className: p?.className || "",
      rollNumber: p?.rollNumber,
      subjects: p?.subjects || [],
      guardianName: p?.guardianName,
      guardianPhone: p?.guardianPhone,
      missingProfile: !p,
    };
  });
  res.json({ success: true, students });
};

exports.createTeacher = async (req, res) => {
  res.status(201).json({ success: true, ...(await userService.createTeacher(req.validated)) });
};

exports.listTeachers = async (req, res) => {
  const users = await User.find({ role: "teacher" }).select(LIST_FIELDS).sort({ createdAt: -1 }).limit(300).lean();
  const profiles = await TeacherProfile.find({ userId: { $in: users.map((u) => u._id) } }).lean();
  const byUser = new Map(profiles.map((p) => [String(p.userId), p]));

  const teachers = users.map((u) => {
    const p = byUser.get(String(u._id));
    return {
      _id: p?._id || u._id,
      userId: withPhoto(u),
      employeeId: p?.employeeId,
      classNames: p?.classNames || [],
      subjects: p?.subjects || [],
      missingProfile: !p,
    };
  });
  res.json({ success: true, teachers });
};

exports.updateProfile = async (req, res) => {
  const { id, ...changes } = req.validated;
  const user = await User.findById(id).select("role");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  if (user.role === "student") await userService.updateStudentProfile(id, changes);
  else if (user.role === "teacher") await userService.updateTeacherProfile(id, changes);
  else return res.status(400).json({ success: false, message: "Only students and teachers have a profile." });

  await refreshRooms(id); // their open tabs now listen to the right classes
  res.json({ success: true });
};

exports.setActive = async (req, res) => {
  const user = await User.findOneAndUpdate(
    { _id: req.validated.id, role: { $ne: "admin" } }, // admins cannot be disabled here
    { isActive: req.validated.isActive, $inc: { tokenVersion: 1 } }, // old tokens die
    { new: true }
  );
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  await audit(req, req.validated.isActive ? "user.enable" : "user.disable", {
    targetType: "user",
    targetId: user._id,
    summary: `${req.validated.isActive ? "Enabled" : "Disabled"} ${user.name} (${user.role})`,
  });
  notify([user._id], {
    type: req.validated.isActive ? "user.enable" : "user.disable",
    title: req.validated.isActive ? "Account enabled" : "Account disabled",
    body: req.validated.isActive
      ? "Your school account is active again."
      : "Your school account has been disabled. Please contact the school office.",
    push: false,
  });
  disconnectUser(user._id); // closes their live connections right away
  res.json({ success: true });
};

exports.resetPassword = async (req, res) => {
  const result = await userService.resetPassword(req.validated.id);
  await audit(req, "user.passwordreset", {
    targetType: "user",
    targetId: req.validated.id,
    summary: "Reset a user's password",
  });
  notify([req.validated.id], {
    type: "user.passwordreset",
    title: "Password reset",
    body: "The admin reset your password. Ask the admin for your temporary password, then change it after you sign in.",
    push: false,
  });
  disconnectUser(req.validated.id);
  res.json({ success: true, ...result });
};

exports.listAudit = async (req, res) => {
  const items = await AuditLog.find().sort({ createdAt: -1 }).limit(150).lean();
  res.json({ success: true, items });
};

/* ---------- groups built automatically from what people typed ---------- */

function mergeCounts(studentRows, teacherRows, extraNames = []) {
  const map = new Map();
  const touch = (name) => {
    if (!map.has(name)) map.set(name, { name, students: 0, teachers: 0 });
    return map.get(name);
  };
  extraNames.forEach(touch);
  studentRows.forEach((x) => { touch(x._id).students = x.n; });
  teacherRows.forEach((x) => { touch(x._id).teachers = x.n; });
  return [...map.values()].sort(byName);
}

exports.listClassGroups = async (req, res) => {
  const [s, t, saved] = await Promise.all([
    StudentProfile.aggregate([
      { $match: { className: { $type: "string", $ne: "" } } },
      { $group: { _id: "$className", n: { $sum: 1 } } },
    ]),
    TeacherProfile.aggregate([{ $unwind: "$classNames" }, { $group: { _id: "$classNames", n: { $sum: 1 } } }]),
    ClassGroup.find().select("name"),
  ]);
  res.json({ success: true, groups: mergeCounts(s, t, saved.map((x) => x.name)) });
};

exports.addClassGroup = async (req, res) => {
  const { name } = req.validated;
  try {
    await ClassGroup.updateOne(
      { key: name.toLowerCase() },
      { $setOnInsert: { name, key: name.toLowerCase() } },
      { upsert: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err; // two people adding the same class at once is fine
  }
  res.status(201).json({ success: true });
};

exports.classGroupDetail = async (req, res) => {
  const { name } = req.validated;
  const [students, teachers] = await Promise.all([
    StudentProfile.find({ className: name }).populate("userId", USER_FIELDS),
    TeacherProfile.find({ classNames: name }).populate("userId", USER_FIELDS),
  ]);
  res.json({ success: true, name, students: students.sort(byRoll), teachers });
};

exports.listBatches = async (req, res) => {
  const count = [{ $unwind: "$subjects" }, { $group: { _id: "$subjects", n: { $sum: 1 } } }];
  const [s, t, subjects] = await Promise.all([
    StudentProfile.aggregate(count),
    TeacherProfile.aggregate(count),
    Subject.find().select("name"),
  ]);
  res.json({ success: true, batches: mergeCounts(s, t, subjects.map((x) => x.name)) });
};

exports.batchDetail = async (req, res) => {
  const { name } = req.validated;
  const [students, teachers] = await Promise.all([
    StudentProfile.find({ subjects: name }).populate("userId", USER_FIELDS).sort({ createdAt: 1 }),
    TeacherProfile.find({ subjects: name }).populate("userId", USER_FIELDS).sort({ createdAt: 1 }),
  ]);
  res.json({ success: true, name, students, teachers });
};