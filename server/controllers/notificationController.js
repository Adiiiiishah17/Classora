const Notification = require("../models/Notification");
const PushSubscription = require("../models/PushSubscription");
const { vapidPublicKey } = require("../utils/notify");

exports.list = async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50).lean(),
    Notification.countDocuments({ userId: req.user.id, readAt: null }),
  ]);
  res.json({ success: true, items, unread });
};

exports.readAll = async (req, res) => {
  await Notification.updateMany({ userId: req.user.id, readAt: null }, { readAt: new Date() });
  res.json({ success: true });
};

exports.readOne = async (req, res) => {
  await Notification.updateOne({ _id: req.validated.id, userId: req.user.id, readAt: null }, { readAt: new Date() });
  res.json({ success: true });
};

exports.vapidKey = (req, res) => {
  res.json({ success: true, key: vapidPublicKey() });
};

exports.subscribe = async (req, res) => {
  const { endpoint, keys } = req.validated;
  await PushSubscription.updateOne(
    { endpoint },
    { $set: { userId: req.user.id, p256dh: keys.p256dh, auth: keys.auth } },
    { upsert: true }
  );

  // Keep at most 10 devices per person
  const mine = await PushSubscription.find({ userId: req.user.id }).sort({ updatedAt: -1 }).select("_id").lean();
  if (mine.length > 10) await PushSubscription.deleteMany({ _id: { $in: mine.slice(10).map((s) => s._id) } });

  res.json({ success: true });
};

exports.unsubscribe = async (req, res) => {
  await PushSubscription.deleteOne({ endpoint: req.validated.endpoint, userId: req.user.id });
  res.json({ success: true });
};