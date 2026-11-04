const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");

// Which items (announcements, documents) this person may see
async function visibleFilter(user) {
  if (user.role === "admin") return {};
  if (user.role === "teacher") {
    return { $or: [{ audience: { $in: ["all", "teachers"] } }, { authorId: user.id }] };
  }
  const p = await StudentProfile.findOne({ userId: user.id }).select("className").lean();
  const or = [{ audience: { $in: ["all", "students"] } }];
  if (p?.className) or.push({ audience: "class", className: p.className });
  return { $or: or };
}

async function recipientIds(a) {
  if (a.audience === "class") {
    const profiles = await StudentProfile.find({ className: a.className }).select("userId").lean();
    const users = await User.find({ _id: { $in: profiles.map((p) => p.userId) }, isActive: true }).select("_id").lean();
    return users.map((u) => String(u._id));
  }
  const roles = a.audience === "students" ? ["student"] : a.audience === "teachers" ? ["teacher"] : ["student", "teacher"];
  const users = await User.find({ role: { $in: roles }, isActive: true }).select("_id").lean();
  return users.map((u) => String(u._id));
}

const roomsFor = (a) => {
  const rooms = ["role:admin"];
  if (a.audience === "class") rooms.push(`class:${a.className}`);
  else {
    if (a.audience !== "teachers") rooms.push("role:student");
    if (a.audience !== "students") rooms.push("role:teacher");
  }
  return rooms;
};

module.exports = { visibleFilter, recipientIds, roomsFor };