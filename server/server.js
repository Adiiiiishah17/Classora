require("dotenv").config();

// Dev-only workaround for Atlas DNS problems. Set DNS_FIX=true in server/.env
if (process.env.DNS_FIX === "true") {
  require("dns").setServers(["8.8.8.8", "8.8.4.4"]);
}

const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const sockets = require("./sockets");
const authRoutes = require("./routes/authRoute");
const adminRoutes = require("./routes/adminRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const documentRoutes = require("./routes/documentRoutes");
const profileRoutes = require("./routes/profileRoutes");
const path = require("path");
const fs = require("fs");

// ---- Config validation ----
for (const key of ["MONGODB_URI", "JWT_SECRET", "GOOGLE_CLIENT_ID"]) {
  if (!process.env[key]) throw new Error(`${key} is missing from the environment.`);
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters.");
}

const PORT = Number(process.env.PORT || 8080);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be a valid port number.");
}
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const isProd = process.env.NODE_ENV === "production";

const app = express();
app.disable("x-powered-by");
if (isProd) app.set("trust proxy", Number(process.env.TRUST_PROXY || 1)); // set to your real proxy hop count

// Browser security rules for the pages themselves (Google sign-in and Google Fonts are the only outside sources)
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": ["'self'", "https://accounts.google.com/gsi/client"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com/gsi/style"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'", CLIENT_ORIGIN.replace(/^http/, "ws"), "https://accounts.google.com/gsi/"],
        "frame-src": ["https://accounts.google.com/gsi/"],
      },
    },
    // Google's sign-in popup needs this setting
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);


app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
// Production: browsers must send changes from our own site only
if (isProd) {
  app.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin && origin !== CLIENT_ORIGIN) {
      return res.status(403).json({ success: false, message: "Request blocked." });
    }
    next();
  });
}

// ---- Rate limits ----
const limiter = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(message ? { message: { success: false, message } } : {}),
  });

const apiLimiter = limiter(15 * 60 * 1000, 600); // many students may share one school IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProd ? 30 : 200,
  skipSuccessfulRequests: true, // only failed attempts count
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Try later." },
});
const requestLimiter = limiter(60 * 60 * 1000, isProd ? 10 : 100, "Too many requests. Try again later.");
const resetLimiter = limiter(60 * 60 * 1000, isProd ? 5 : 50, "Too many attempts. Try again later.");
const checkLimiter = limiter(15 * 60 * 1000, isProd ? 40 : 500, "Too many attempts. Try again later.");

app.use("/api", apiLimiter);

// Browsers must not keep API answers, so Back never shows old data after logout
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// ---- Routes ----
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/admin/login", loginLimiter);
app.use("/api/auth/code-login", loginLimiter);
app.use("/api/auth/google", loginLimiter);
app.use("/api/auth/check-identifier", checkLimiter);
app.use("/api/auth/request-access", requestLimiter);
app.use("/api/auth/forgot-password", resetLimiter);
app.use("/api/auth/reset-password", resetLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/profile", profileRoutes);


// TEMPORARY: shows which TRUST_PROXY number gives your real IP. Delete this route after Part 4, step 3.
app.get("/__ip", (req, res) => res.json({ ip: req.ip, forwardedFor: req.headers["x-forwarded-for"] || null }));

// ---- Serve the built React app (production only) ----
const clientDist = path.join(__dirname, "..", "client", "dist");
if (isProd && fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders: (res, filePath) => {
        const hashed = filePath.includes(`${path.sep}assets${path.sep}`); // Vite puts a hash in these file names
        res.setHeader("Cache-Control", hashed ? "public, max-age=31536000, immutable" : "no-cache");
      },
    })
  );
  // Any other page address (like /admin/login or /student) opens the React app
  app.get(/^\/(?!api(?:\/|$)|socket\.io(?:\/|$)|health$).*/, (req, res) => {
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(clientDist, "index.html"));
  });
}
// ---- 404 and error handling (always last) ----
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid request body." });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    const message =
      field === "username" ? "That username is already taken."
      : field === "email" ? "That email already has an account."
      : field === "phone" ? "That phone number is already registered."
      : field === "rollNumber" || field === "className" ? "That roll number is already used in this class."
      : "This record already exists.";
    return res.status(409).json({ success: false, message });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid id." });
  }

  console.error("Request failed:", err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message:
      err.status && err.status < 500
        ? err.message
        : isProd
        ? "An unexpected error occurred."
        : err.message,
  });
});

// ---- Startup and shutdown ----
async function startServer() {
  await connectDB();

  const server = http.createServer(app);
  const io = sockets.init(server, CLIENT_ORIGIN); // live notifications ride on the same server
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received. Shutting down...`);

    const forceExit = setTimeout(() => process.exit(1), 10000);
    forceExit.unref();

    // io.close() also closes the HTTP server
    io.close(async () => {
      try {
        await mongoose.disconnect();
        process.exit(0);
      } catch {
        process.exit(1);
      }
    });
  }
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

startServer().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});