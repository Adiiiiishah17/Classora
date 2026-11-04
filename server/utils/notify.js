const User = require("../models/User");
const Notification = require("../models/Notification");
const PushSubscription = require("../models/PushSubscription");
const { sendMail } = require("./mailer");
const { emitTo } = require("../sockets");

const APP_URL = process.env.CLIENT_ORIGIN || "http://localhost:5173";

// Phone alerts (Web Push) turn on only when the keys are in .env
let webpush = null;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush = require("web-push");
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@example.com",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch (err) {
    console.error("Web push is not configured:", err.message);
    webpush = null;
  }
}

const range = (a, b) => (a === b ? a : `${a} to ${b}`);

// "admins" or a list of user ids
async function recipients(to) {
  const list = Array.isArray(to) ? to : [to];
  const ids = new Set(list.filter((x) => x && x !== "admins").map(String));
  if (list.includes("admins")) {
    const admins = await User.find({ role: "admin", isActive: true }).select("_id").lean();
    admins.forEach((a) => ids.add(String(a._id)));
  }
  return [...ids];
}

async function sendEmails(ids, title, body) {
  const users = await User.find({ _id: { $in: ids } }).select("email name").lean();
  for (const u of users) {
    if (!u.email) continue;
    try {
      await sendMail({
        to: u.email,
        subject: title,
        text: `Hello ${u.name},\n\n${body}\n\nOpen the school portal: ${APP_URL}\n`,
      });
    } catch (err) {
      console.error("Email failed:", err.message);
    }
  }
}

async function sendPush(ids, title, body) {
  const subs = await PushSubscription.find({ userId: { $in: ids } }).lean();
  const payload = JSON.stringify({ title, body });
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 3600 }
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id });
        else console.error("Push failed:", err.statusCode || err.message);
      }
    })
  );
}

// Bell + live event + email + phone. It never throws, so call it without await.
async function notify(to, { type, title, body, email = true, push = true }) {
  try {
    const ids = await recipients(to);
    if (!ids.length) return;
    await Notification.insertMany(ids.map((userId) => ({ userId, type, title, body })));
    emitTo(ids.map((id) => `user:${id}`), "notify:new", { type, title });
    if (push && webpush) sendPush(ids, title, body).catch(() => {});
    if (email) sendEmails(ids, title, body).catch(() => {});
  } catch (err) {
    console.error("Notify failed:", err.message);
  }
}

// Absent and Late only; Present never sends anything
async function notifyAttendance(rows, date) {
  try {
    for (const status of ["absent", "late"]) {
      const ids = rows.filter((r) => r.status === status).map((r) => r.userId);
      if (ids.length) {
        await notify(ids, {
          type: `attendance.${status}`,
          title: `Marked ${status}`,
          body: `You were marked ${status} on ${date}.`,
        });
      }
    }
  } catch (err) {
    console.error("Attendance notify failed:", err.message);
  }
}

// For people who have no account yet (account requests)
async function mailOnly(to, subject, text) {
  try {
    await sendMail({ to, subject, text });
  } catch (err) {
    console.error("Email failed:", err.message);
  }
}

module.exports = { notify, notifyAttendance, mailOnly, range, vapidPublicKey: () => (webpush ? process.env.VAPID_PUBLIC_KEY : "") };