require("dotenv").config();

if (process.env.DNS_FIX === "true") {
  require("dns").setServers(["8.8.8.8", "8.8.4.4"]);
}

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const StudentProfile = require("../models/StudentProfile");

async function main() {
  try {
    await connectDB();
    try {
      await StudentProfile.collection.dropIndex("class_1_rollNumber_1");
      console.log("Old roll number index dropped.");
    } catch (e) {
      console.log("Old index not found (that is fine):", e.codeName || e.message);
    }
    await StudentProfile.createIndexes();
    console.log("Indexes are up to date.");
  } catch (e) {
    console.error("Failed:", e.message);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}
main();