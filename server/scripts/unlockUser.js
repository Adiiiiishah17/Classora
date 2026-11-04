require("dotenv").config();

if (process.env.DNS_FIX === "true") {
  require("dns").setServers(["8.8.8.8", "8.8.4.4"]);
}

const readline = require("readline");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

async function main() {
  try {
    await connectDB();
    const email = (await ask("Email to unlock: ")).trim().toLowerCase();
    const result = await User.updateOne(
      { email },
      { failedLoginCount: 0, $unset: { lockUntil: 1 } }
    );
    console.log(result.matchedCount ? "Unlocked." : "No user with that email.");
  } catch (e) {
    console.error("Failed:", e.message);
  } finally {
    rl.close();
    await mongoose.disconnect().catch(() => {});
  }
}
main();