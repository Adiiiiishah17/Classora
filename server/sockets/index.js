const { Server } = require("socket.io");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const TeacherProfile = require("../models/TeacherProfile");

let io = null;

// Rooms are decided by the server from the database, never by the browser.
//   user:<id>       one person
//   role:<role>     everyone with a role
//   class:<name>    students and teachers of a class
//   teachers:<name> only the teachers of a class (student leave requests go here)
async function roomsFor(user) {
  const rooms = [`user:${user.id}`, `role:${user.role}`];
  if (user.role === "student") {
    const p = await StudentProfile.findOne({ userId: user.id }).select("className").lean();
    if (p?.className) rooms.push(`class:${p.className}`);
  } else if (user.role === "teacher") {
    const p = await TeacherProfile.findOne({ userId: user.id }).select("classNames").lean();
    for (const c of p?.classNames || []) rooms.push(`class:${c}`, `teachers:${c}`);
  }
  return rooms;
}

function init(httpServer, clientOrigin) {
  io = new Server(httpServer, {
    cors: { origin: clientOrigin, credentials: true },
    maxHttpBufferSize: 1e4,
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      cb(null, !origin || origin === clientOrigin);
    },
  });

  // Every connection must carry a valid, current login cookie
  io.use(async (socket, next) => {
    try {
      const token = cookie.parse(socket.handshake.headers.cookie || "").accessToken;
      if (!token) return next(new Error("Unauthorized"));

      const payload = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: "school-management-api",
        audience: "school-management-client",
        algorithms: ["HS256"],
      });
      const user = await User.findById(payload.sub).select("role isActive tokenVersion mustChangePassword");
      if (!user || !user.isActive || user.mustChangePassword || payload.tv !== user.tokenVersion) {
        return next(new Error("Unauthorized"));
      }
      socket.user = { id: user.id, role: user.role };
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    try {
      await socket.join(await roomsFor(socket.user));
    } catch {
      socket.disconnect(true);
    }
    // No client-to-server events on purpose: all changes go through the REST API.
  });

  return io;
}

function emitTo(rooms, event, payload = {}) {
  if (!io) return;
  try {
    io.to(rooms).emit(event, payload);
  } catch (err) {
    console.error("Socket emit failed:", err.message);
  }
}

// After an admin changes someone's classes: update the rooms of their open tabs
async function refreshRooms(userId) {
  if (!io) return;
  try {
    const sockets = await io.in(`user:${userId}`).fetchSockets();
    if (!sockets.length) return;
    const user = await User.findById(userId).select("role").lean();
    if (!user) return;
    const rooms = await roomsFor({ id: String(userId), role: user.role });
    for (const s of sockets) {
      for (const r of s.rooms) if (r !== s.id && !rooms.includes(r)) s.leave(r);
      s.join(rooms);
    }
  } catch (err) {
    console.error("Refreshing rooms failed:", err.message);
  }
}

function disconnectUser(userId) {
  if (io) io.in(`user:${userId}`).disconnectSockets(true);
}

module.exports = { init, emitTo, refreshRooms, disconnectUser };