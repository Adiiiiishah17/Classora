const { z } = require("zod");
const User = require("../models/User");
const AccessRequest = require("../models/AccessRequest");
const userService = require("../services/userService");
const { hashPassword } = require("../utils/password");
const { normalizePhone } = require("../utils/phone");
const { audit } = require("../utils/audit");
const { notify, mailOnly } = require("../utils/notify");
const { emitTo } = require("../sockets");

const httpError = (message, status) => Object.assign(new Error(message), { status });

/* ---------------- PUBLIC ---------------- */

// Step 1 of "Request account": is this email or phone already known?
exports.checkIdentifier = async (req, res) => {
  const raw = req.validated.identifier;
  let field;
  let value;

  if (raw.includes("@")) {
    if (!z.email().safeParse(raw).success) throw httpError("Enter a valid email address.", 400);
    field = "email";
    value = raw;
  } else {
    const phone = normalizePhone(raw);
    if (!phone) throw httpError("Enter a valid email or 10-digit mobile number.", 400);
    field = "phone";
    value = phone;
  }

  const [user, pending] = await Promise.all([
    User.exists({ [field]: value }),
    AccessRequest.exists({ [field]: value, status: "pending" }),
  ]);

  res.json({ success: true, type: field, value, status: user ? "registered" : pending ? "pending" : "new" });
};

// Step 2: send the full registration request
exports.submit = async (req, res) => {
  const d = req.validated;

  const clash = { $or: [{ email: d.email }, { phone: d.phone }, { username: d.username }] };
  const [existingUser, existingRequest] = await Promise.all([
    User.findOne(clash).select("email phone username"),
    AccessRequest.findOne({ ...clash, status: "pending" }).select("email phone username"),
  ]);

  if (existingUser) {
    if (existingUser.email === d.email || existingUser.phone === d.phone) {
      throw httpError("An account already exists with this email or phone number. Please sign in.", 409);
    }
    throw httpError("That username is already taken.", 409);
  }
  if (existingRequest) {
    if (existingRequest.email === d.email || existingRequest.phone === d.phone) {
      throw httpError("You already have a request waiting for approval.", 409);
    }
    throw httpError("That username is already taken.", 409);
  }

  await AccessRequest.create({
    name: d.name,
    email: d.email,
    username: d.username,
     phone: d.phone,
    dob: d.dob,
    role: d.role,
    passwordHash: await hashPassword(d.password), // the plain password is never stored
    className: d.role === "student" ? d.className : undefined,
    classNames: d.role === "teacher" ? d.classNames || [] : [],
    subjects: d.subjects || [],
    message: d.message,
  });

  emitTo("role:admin", "request:new", {}); // the admin's dashboard updates live
  notify("admins", {
    type: "request.new",
    title: "New account request",
    body: `${d.name} asked for a ${d.role} account.`,
  });

  res.status(201).json({ success: true, message: "Request sent! The school admin will review it." });
};

/* ---------------- ADMIN ONLY ---------------- */

exports.list = async (req, res) => {
  const requests = await AccessRequest.find({ status: req.validated.status })
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({ success: true, requests });
};

// One click: everything comes from the request
exports.approve = async (req, res) => {
  const request = await AccessRequest.findOne({
    _id: req.validated.id,
    status: "pending",
  }).select("+passwordHash");
  if (!request) throw httpError("Request not found.", 404);

  if (!request.passwordHash || !request.username || !request.phone) {
    throw httpError(
      "This request is from an older version of the form and is incomplete. Please reject it and ask the person to register again.",
      400
    );
  }

  const base = {
    name: request.name,
    email: request.email,
    username: request.username,
     phone: request.phone,
    dob: request.dob,
    passwordHash: request.passwordHash,
    subjects: [...(request.subjects || [])],
  };

  const result =
    request.role === "student"
      ? await userService.createStudent({ ...base, className: request.className || undefined })
      : await userService.createTeacher({ ...base, classNames: [...(request.classNames || [])] });

  await AccessRequest.updateOne(
    { _id: request._id },
    {
      status: "approved",
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
      createdUserId: result.user.id,
      $unset: { passwordHash: 1 },
    }
  );
  await audit(req, "request.approve", {
    targetType: "request",
    targetId: request._id,
    summary: `Approved ${request.name} as ${request.role}`,
  });

  mailOnly(
    request.email,
    "Your account is approved",
    `Hello ${request.name},\n\nYour school account request was approved. You can now sign in with your username "${request.username}" and the password you chose.\n`
  );

  res.json({ success: true, user: result.user });
};

exports.reject = async (req, res) => {
  const r = await AccessRequest.findOneAndUpdate(
    { _id: req.validated.id, status: "pending" },
    { status: "rejected", reviewedBy: req.user.id, reviewedAt: new Date(), $unset: { passwordHash: 1 } }
  );
  if (!r) throw httpError("Request not found.", 404);
  await audit(req, "request.reject", {
    targetType: "request",
    targetId: r._id,
    summary: `Rejected the request from ${r.name} (${r.role})`,
  });

  mailOnly(
    r.email,
    "Your account request",
    `Hello ${r.name},\n\nYour school account request was not approved. Please contact the school office for details.\n`
  );

  res.json({ success: true });
};