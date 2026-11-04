const crypto = require("crypto");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const TeacherProfile = require("../models/TeacherProfile");
const userService = require("../services/userService");
const photos = require("../utils/photoStorage");
const { verifyPassword } = require("../utils/password");
const { audit } = require("../utils/audit");
const { refreshRooms } = require("../sockets");

const httpError = (message, status) => Object.assign(new Error(message), { status });
const stamp = (d) => (d ? new Date(d).getTime() : 0);

const shape = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  username: u.username,
  phone: u.phone,
  dob: u.dob || "",
  role: u.role,
  hasPhoto: !!u.photoName,
  photoV: stamp(u.photoUpdatedAt),
});

async function profileOf(user) {
  if (user.role === "student") {
    const p = await StudentProfile.findOne({ userId: user._id }).lean();
    return {
      className: p?.className || "",
      rollNumber: p?.rollNumber || "",
      subjects: p?.subjects || [],
      guardianName: p?.guardianName || "",
      guardianPhone: p?.guardianPhone || "",
    };
  }
  if (user.role === "teacher") {
    const p = await TeacherProfile.findOne({ userId: user._id }).lean();
    return {
      employeeId: p?.employeeId || "",
      classNames: p?.classNames || [],
      subjects: p?.subjects || [],
      bio: p?.bio || "",
    };
  }
  return {};
}

async function applyProfile(Model, userId, set, unset) {
  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  if (Object.keys(update).length) await Model.updateOne({ userId }, update, { upsert: true });
}

/* ---------------- the signed-in student or teacher ---------------- */

exports.me = async (req, res) => {
  const user = await User.findById(req.user.id)
    .select("name email username phone dob role photoName photoUpdatedAt +passwordHash")
    .lean();
  if (!user) throw httpError("Account not found.", 404);
  res.json({
    success: true,
    user: shape(user),
    profile: await profileOf(user),
    security: { hasPassword: !!user.passwordHash },
  });
};

exports.updateMe = async (req, res) => {
  const d = req.validated;
  const isStudent = req.user.role === "student";

  // ---- check everything first, then write ----
  const userSet = {};
  const userUnset = {};
  if (d.name !== undefined) userSet.name = d.name;
  if (d.username !== undefined) userSet.username = d.username;
  if (d.phone !== undefined) userSet.phone = d.phone;
  if (d.dob !== undefined) { if (d.dob === "") userUnset.dob = 1; else userSet.dob = d.dob; }

  if (d.email !== undefined) {
    const me = await User.findById(req.user.id).select("email +passwordHash");
    if (me && d.email !== me.email) {
      if (!me.passwordHash) {
        throw httpError("Set a password first (use “Forgot password” on the sign-in page), then you can change your email.", 400);
      }
      if (!d.currentPassword || !(await verifyPassword(d.currentPassword, me.passwordHash))) {
        throw httpError("Your current password is not correct.", 400);
      }
      userSet.email = d.email;
    }
  }

  // ---- the user record (duplicates become friendly errors in the global handler) ----
  const userUpdate = {};
  if (Object.keys(userSet).length) userUpdate.$set = userSet;
  if (Object.keys(userUnset).length) userUpdate.$unset = userUnset;
  if (Object.keys(userUpdate).length) {
    await User.updateOne({ _id: req.user.id }, userUpdate, { runValidators: true });
  }

  // ---- the profile ----
  const set = {};
  const unset = {};
  const put = (key, val) => { if (val === "") unset[key] = 1; else set[key] = val; };

  if (isStudent) {
    if (d.guardianName !== undefined) put("guardianName", d.guardianName);
    if (d.guardianPhone !== undefined) put("guardianPhone", d.guardianPhone);
    await applyProfile(StudentProfile, req.user.id, set, unset);
    if (d.className !== undefined || d.subjects !== undefined) {
      await userService.updateStudentProfile(req.user.id, { className: d.className, subjects: d.subjects });
    }
  } else {
    if (d.bio !== undefined) put("bio", d.bio);
    await applyProfile(TeacherProfile, req.user.id, set, unset);
    if (d.classNames !== undefined || d.subjects !== undefined) {
      await userService.updateTeacherProfile(req.user.id, { classNames: d.classNames, subjects: d.subjects });
    }
  }

  // ---- log: field names always, and class/subject values (they are not private) ----
  const fields = Object.keys(d).filter((k) => k !== "currentPassword");
  const meta = { fields };
  if (d.className !== undefined) meta.className = d.className;
  if (d.classNames !== undefined) meta.classNames = d.classNames;
  if (d.subjects !== undefined) meta.subjects = d.subjects;
  await audit(req, "profile.update", {
    targetType: "user",
    targetId: req.user.id,
    summary: `${req.user.name} (${req.user.role}) updated: ${fields.join(", ")}`,
    meta,
  });

  // A new class means new live rooms (attendance, announcements) for this person's open tabs
  if (d.className !== undefined || d.classNames !== undefined) await refreshRooms(req.user.id);

  res.json({ success: true });
};

/* ---------------- photo ---------------- */

exports.uploadPhoto = async (req, res) => {
  if (!req.file) throw httpError("Choose a photo first.", 400);
  const type = photos.detectType(req.file.buffer);
  if (!type) throw httpError("Only JPG, PNG or WebP photos are allowed.", 400);

  const storedName = `${crypto.randomBytes(16).toString("hex")}.${type.ext}`;
  await photos.write(storedName, req.file.buffer);

  const now = new Date();
  let before;
  try {
    // returns the document as it was before the update, so we know which old file to delete
    before = await User.findByIdAndUpdate(req.user.id, { photoName: storedName, photoUpdatedAt: now })
      .select("photoName")
      .lean();
  } catch (err) {
    await photos.remove(storedName); // do not leave an orphan file behind
    throw err;
  }
  if (before?.photoName) await photos.remove(before.photoName);

  await audit(req, "photo.update", {
    targetType: "user",
    targetId: req.user.id,
    summary: `${req.user.name} (${req.user.role}) ${before?.photoName ? "changed" : "added"} their profile photo`,
  });

  res.json({ success: true, photoV: now.getTime() });
};

exports.removePhoto = async (req, res) => {
  const before = await User.findByIdAndUpdate(req.user.id, { $unset: { photoName: 1, photoUpdatedAt: 1 } })
    .select("photoName")
    .lean();
  if (before?.photoName) {
    await photos.remove(before.photoName);
    await audit(req, "photo.remove", {
      targetType: "user",
      targetId: req.user.id,
      summary: `${req.user.name} (${req.user.role}) removed their profile photo`,
    });
  }
  res.json({ success: true });
};

// Shows a photo only to: the owner, the admin, and students looking at a teacher
exports.photo = async (req, res) => {
  const { id } = req.validated;
  const target = await User.findById(id).select("role isActive photoName").lean();
  const me = req.user;

  const allowed =
    target &&
    (me.id === id || me.role === "admin" || (me.role === "student" && target.role === "teacher" && target.isActive));

  if (!allowed || !target.photoName || !photos.NAME_RE.test(target.photoName)) {
    return res.status(404).json({ success: false, message: "No photo." });
  }

  res.set({
    "Content-Type": photos.mimeFor(target.photoName),
    "Cache-Control": "private, no-cache",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  });
  res.sendFile(target.photoName, { root: photos.DIR, dotfiles: "deny", cacheControl: false }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ success: false, message: "No photo." });
  });
};

/* ---------------- Know your tutor (students) ---------------- */

exports.tutors = async (req, res) => {
  const users = await User.find({ role: "teacher", isActive: true })
    .select("name photoName photoUpdatedAt")
    .sort({ name: 1 })
    .limit(300)
    .lean();
  const profiles = await TeacherProfile.find({ userId: { $in: users.map((u) => u._id) } })
    .select("userId subjects bio")
    .lean();
  const byUser = new Map(profiles.map((p) => [String(p.userId), p]));

  res.json({
    success: true,
    tutors: users.map((u) => {
      const p = byUser.get(String(u._id));
      return {
        id: String(u._id),
        name: u.name,
        hasPhoto: !!u.photoName,
        photoV: stamp(u.photoUpdatedAt),
        subjects: p?.subjects || [],
        bio: p?.bio || "",
      };
    }),
  });
};

/* ---------------- admin: read-only ---------------- */

exports.adminView = async (req, res) => {
  const user = await User.findOne({ _id: req.validated.id, role: { $in: ["student", "teacher"] } })
    .select("name email username phone dob role isActive lastLoginAt createdAt photoName photoUpdatedAt")
    .lean();
  if (!user) throw httpError("User not found.", 404);

  await audit(req, "profile.view", {
    targetType: "user",
    targetId: user._id,
    summary: `Viewed the profile of ${user.name} (${user.role})`,
  });

  res.json({
    success: true,
    user: { ...shape(user), isActive: user.isActive, lastLoginAt: user.lastLoginAt || null, createdAt: user.createdAt },
    profile: await profileOf(user),
  });
};