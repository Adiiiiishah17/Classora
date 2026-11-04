const TeacherProfile = require("../models/TeacherProfile");
const StudentProfile = require("../models/StudentProfile");
const ClassGroup = require("../models/ClassGroup");

const numeric = (a, b) => a.localeCompare(b, undefined, { numeric: true });

async function teacherClasses(userId) {
  const p = await TeacherProfile.findOne({ userId }).select("classNames").lean();
  return p?.classNames || [];
}

// Attendance: every teacher and the admin can work with every class
async function classesFor(user) {
  if (user.role !== "admin" && user.role !== "teacher") return [];
  const [a, b] = await Promise.all([
    StudentProfile.distinct("className", { className: { $type: "string", $ne: "" } }),
    ClassGroup.distinct("name"),
  ]);
  return [...new Set([...a, ...b])].sort(numeric);
}

// Leave approval: a teacher decides only for classes on their own profile
async function canManageClass(user, name) {
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;
  return (await teacherClasses(user.id)).includes(name);
}

module.exports = { teacherClasses, classesFor, canManageClass };