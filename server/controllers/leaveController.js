const LeaveRequest = require("../models/LeaveRequest");
const StudentProfile = require("../models/StudentProfile");
const { todayStr, daysBetween } = require("../utils/dates");
const { audit } = require("../utils/audit");
const { emitTo } = require("../sockets");
const { notify, range } = require("../utils/notify");

const httpError = (message, status) => Object.assign(new Error(message), { status });

exports.create = async (req, res) => {
  const { fromDate, toDate, reason } = req.validated;
  const today = todayStr();

  if (toDate < fromDate) throw httpError("The end date cannot be before the start date.", 400);
  if (daysBetween(fromDate, today) > 7) throw httpError("You can apply for leave only up to 7 days back.", 400);
  if (daysBetween(today, toDate) > 365) throw httpError("That date is too far ahead.", 400);

  const overlap = await LeaveRequest.exists({
    applicantId: req.user.id,
    status: { $in: ["pending", "approved"] },
    fromDate: { $lte: toDate },
    toDate: { $gte: fromDate },
  });
  if (overlap) throw httpError("You already have a leave request for some of these dates.", 409);

  let className = "";
  if (req.user.role === "student") {
    const p = await StudentProfile.findOne({ userId: req.user.id }).select("className").lean();
    className = p?.className || "";
  }

  const leave = await LeaveRequest.create({
    applicantId: req.user.id,
    applicantRole: req.user.role,
    className,
    fromDate,
    toDate,
    reason,
  });

  emitTo("role:admin", "leave:new", { id: String(leave._id) });
    notify("admins", {
    type: "leave.new",
    title: "New leave request",
    body: `${req.user.name} (${req.user.role}) asked for leave: ${range(fromDate, toDate)}.`,
  });
  res.status(201).json({ success: true });
};

exports.mine = async (req, res) => {
  const items = await LeaveRequest.find({ applicantId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("decidedBy", "name")
    .lean();
  res.json({ success: true, items });
};

exports.cancel = async (req, res) => {
  const leave = await LeaveRequest.findOneAndUpdate(
    { _id: req.validated.id, applicantId: req.user.id, status: "pending" },
    { status: "cancelled" }
  );
  if (!leave) throw httpError("This request can no longer be cancelled.", 404);
  emitTo("role:admin", "leave:cancelled", { id: String(leave._id) });
    notify("admins", { type: "leave.cancelled", title: "Leave request cancelled", body: `${req.user.name} cancelled a leave request.`, email: false, push: false });
  res.json({ success: true });
};

// Admin only: every request from students and teachers
exports.inbox = async (req, res) => {
  const { status } = req.validated;
  const filter = status === "all" ? {} : { status };

  const items = await LeaveRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("applicantId", "name username phone")
    .populate("decidedBy", "name")
    .lean();
  res.json({ success: true, items });
};

exports.decide = async (req, res) => {
  const { id, decision, note } = req.validated;

  // Only one decision can win, even if two clicks arrive together
  const updated = await LeaveRequest.findOneAndUpdate(
    { _id: id, status: "pending" },
    {
      status: decision === "approve" ? "approved" : "rejected",
      decidedBy: req.user.id,
      decidedAt: new Date(),
      decisionNote: note || "",
    },
    { new: true }
  );
  if (!updated) throw httpError("This request was already handled or does not exist.", 409);

  await audit(req, `leave.${decision}`, {
    targetType: "leave",
    targetId: id,
    summary: `${decision === "approve" ? "Approved" : "Rejected"} leave ${updated.fromDate} to ${updated.toDate} (${updated.applicantRole})`,
    meta: { applicantId: String(updated.applicantId), note: note || "" },
  });

  emitTo(`user:${updated.applicantId}`, "leave:decided", { id: String(id), status: updated.status });
  emitTo("role:admin", "leave:handled", { id: String(id) });
    notify([updated.applicantId], {
    type: `leave.${decision}`,
    title: `Leave ${updated.status}`,
    body: `Your leave for ${range(updated.fromDate, updated.toDate)} was ${updated.status}.${note ? ` Note: ${note}` : ""}`,
  });
  res.json({ success: true });
};