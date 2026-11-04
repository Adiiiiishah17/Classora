const Announcement = require("../models/Announcement");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const { audit } = require("../utils/audit");
const { notify } = require("../utils/notify");
const { emitTo } = require("../sockets");

const httpError = (message, status) => Object.assign(new Error(message), { status });

// Which announcements this person may see
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

exports.list = async (req, res) => {
  const filter = await visibleFilter(req.user);
  const items = await Announcement.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  res.json({
    success: true,
    items: items.map((a) => ({ ...a, mine: String(a.authorId) === req.user.id })),
  });
};

exports.create = async (req, res) => {
  const d = req.validated;

  // Teachers write to students or a class only
  if (req.user.role === "teacher" && !["students", "class"].includes(d.audience)) {
    throw httpError("You can send announcements to students or to a class.", 403);
  }

  const a = await Announcement.create({
    title: d.title,
    body: d.body,
    audience: d.audience,
    className: d.audience === "class" ? d.className : undefined,
    urgent: !!d.urgent,
    authorId: req.user.id,
    authorName: req.user.name,
    authorRole: req.user.role,
  });

  await audit(req, "announcement.post", {
    targetType: "announcement",
    targetId: a._id,
    summary: `Posted "${a.title}" to ${a.audience === "class" ? `class ${a.className}` : a.audience}`,
  });

  emitTo(roomsFor(a), "announcement:changed", {});
  emitTo(roomsFor(a), "announcement:new", { title: a.title, authorId: req.user.id });

  const ids = (await recipientIds(a)).filter((id) => id !== req.user.id);
  if (ids.length) {
    notify(ids, {
      type: "announcement",
      title: `📢 ${a.title}`,
      body: a.body.length > 140 ? `${a.body.slice(0, 140)}…` : a.body,
      email: a.urgent,
    });
  }

  res.status(201).json({ success: true });
};

async function ownOrAdmin(req) {
  const a = await Announcement.findById(req.validated.id);
  if (!a) throw httpError("Announcement not found.", 404);
  if (req.user.role !== "admin" && String(a.authorId) !== req.user.id) {
    throw httpError("You can change only your own announcements.", 403);
  }
  return a;
}

exports.update = async (req, res) => {
  const a = await ownOrAdmin(req);
  const { title, body, urgent } = req.validated;
  a.title = title;
  a.body = body;
  a.urgent = !!urgent;
  await a.save();
  emitTo(roomsFor(a), "announcement:changed", {});
  res.json({ success: true });
};

exports.remove = async (req, res) => {
  const a = await ownOrAdmin(req);
  await a.deleteOne();
  await audit(req, "announcement.delete", {
    targetType: "announcement",
    targetId: a._id,
    summary: `Deleted the announcement "${a.title}"`,
  });
  emitTo(roomsFor(a), "announcement:changed", {});
  res.json({ success: true });
};