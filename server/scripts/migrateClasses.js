require("dotenv").config();

if (process.env.DNS_FIX === "true") {
  require("dns").setServers(["8.8.8.8", "8.8.4.4"]);
}

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Class = require("../models/Class");
const StudentProfile = require("../models/StudentProfile");
const TeacherProfile = require("../models/TeacherProfile");
const { normalizeClass } = require("../utils/classes");

async function main() {
  try {
    await connectDB();

    try {
      await StudentProfile.collection.dropIndex("class_1_rollNumber_1");
      console.log("Old roll number index dropped.");
    } catch (e) {
      console.log("Old index not found (fine):", e.codeName || e.message);
    }

    const label = new Map(
      (await Class.find().lean()).map((c) => [String(c._id), normalizeClass(`${c.name}-${c.section}`)])
    );

    let s = 0;
    for (const p of await StudentProfile.collection.find({ class: { $exists: true } }).toArray()) {
      const name = label.get(String(p.class));
      await StudentProfile.collection.updateOne(
        { _id: p._id },
        { ...(name ? { $set: { className: name } } : {}), $unset: { class: "" } }
      );
      s++;
    }

    let t = 0;
    for (const p of await TeacherProfile.collection.find({ classes: { $exists: true } }).toArray()) {
      const names = (p.classes || []).map((id) => label.get(String(id))).filter(Boolean);
      await TeacherProfile.collection.updateOne(
        { _id: p._id },
        { $set: { classNames: [...new Set(names)] }, $unset: { classes: "" } }
      );
      t++;
    }
    console.log(`Converted ${s} student profile(s) and ${t} teacher profile(s).`);

    await StudentProfile.createIndexes();
    await TeacherProfile.createIndexes();
    console.log("Indexes are up to date.");
  } catch (e) {
    console.error("Failed:", e.message);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}
main();