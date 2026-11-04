require("dotenv").config();
const mongoose = require("mongoose");
const StudentProfile = require("../models/StudentProfile");
const TeacherProfile = require("../models/TeacherProfile");
const ClassGroup = require("../models/ClassGroup");
const Attendance = require("../models/Attendance");
const LeaveRequest = require("../models/LeaveRequest");

const APPLY = process.argv.includes("--apply");
const num = (a, b) => String(a || "").localeCompare(String(b || ""), undefined, { numeric: true });

// "10-A", "10 a", "10A" -> "10". Other names are only trimmed and upper-cased.
function strip(s) {
  const v = String(s || "").trim().replace(/^class\s+/i, "").trim();
  const m = v.match(/^(\d+)\s*-?\s*[A-Za-z]$/);
  return (m ? m[1] : v).toUpperCase();
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(APPLY ? "APPLYING changes" : "DRY RUN (add --apply to save)");

  // Students: merge sections and give roll numbers 1, 2, 3 ... in each class
  const students = await StudentProfile.find({ className: { $type: "string", $ne: "" } }).lean();
  const groups = new Map();
  for (const s of students) {
    const n = strip(s.className);
    if (!groups.has(n)) groups.set(n, []);
    groups.get(n).push(s);
  }
  for (const [name, list] of groups) {
    if (!list.some((s) => s.className !== name)) continue;
    list.sort((a, b) => num(a.className, b.className) || num(a.rollNumber, b.rollNumber));
    console.log(`Class ${name}: ${list.length} students (from ${[...new Set(list.map((s) => s.className))].join(", ")})`);
    if (!APPLY) continue;
    await StudentProfile.updateMany({ _id: { $in: list.map((s) => s._id) } }, { $unset: { rollNumber: "" } });
    let i = 1;
    for (const s of list) {
      await StudentProfile.updateOne({ _id: s._id }, { $set: { className: name, rollNumber: String(i++) } });
    }
  }

  // Teachers
  for (const t of await TeacherProfile.find({ "classNames.0": { $exists: true } }).lean()) {
    const next = [...new Set(t.classNames.map(strip))];
    if (next.join("|") === t.classNames.join("|")) continue;
    console.log(`Teacher classes: ${t.classNames.join(", ")} -> ${next.join(", ")}`);
    if (APPLY) await TeacherProfile.updateOne({ _id: t._id }, { $set: { classNames: next } });
  }

  // Saved class names
  for (const g of await ClassGroup.find().lean()) {
    const n = strip(g.name);
    if (n === g.name) continue;
    console.log(`Class group: ${g.name} -> ${n}`);
    if (!APPLY) continue;
    const clash = await ClassGroup.findOne({ key: n.toLowerCase(), _id: { $ne: g._id } });
    if (clash) await ClassGroup.deleteOne({ _id: g._id });
    else await ClassGroup.updateOne({ _id: g._id }, { $set: { name: n, key: n.toLowerCase() } });
  }

    for (const M of [Attendance, LeaveRequest]) {
    for (const old of await M.distinct("className")) {
      const n = strip(old);
      if (!old || n === old) continue;
      console.log(`${M.modelName}: ${old} -> ${n}`);
      if (APPLY) await M.updateMany({ className: old }, { $set: { className: n } });
    }
  }

  await mongoose.disconnect();
  console.log("Done.");
})().catch((e) => { console.error(e); process.exit(1); });