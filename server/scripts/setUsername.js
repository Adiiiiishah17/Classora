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
    const email = (await ask("Account email: ")).trim().toLowerCase();
    const username = (await ask("New username (letters, numbers, . _): ")).trim().toLowerCase();
    if (!/^[a-z0-9._]{3,30}$/.test(username)) throw new Error("Use 3-30 letters, numbers, dot or underscore.");

    const taken = await User.exists({ username });
    if (taken) throw new Error("That username is already taken.");

    const r = await User.updateOne({ email }, { username });
    console.log(r.matchedCount ? "Username saved." : "No user with that email.");
  } catch (e) {
    console.error("Failed:", e.message);
  } finally {
    rl.close();
    await mongoose.disconnect().catch(() => {});
  }
}
main();