const mongoose = require("mongoose");

const pushSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true, maxlength: 600 },
    p256dh: { type: String, required: true, maxlength: 200 },
    auth: { type: String, required: true, maxlength: 100 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PushSubscription", pushSchema);