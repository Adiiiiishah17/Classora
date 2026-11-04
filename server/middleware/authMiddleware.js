const jwt = require("jsonwebtoken");
const User = require("../models/User");

function authenticate({ allowTempPassword = false } = {}) {
  return async (req, res, next) => {
    try {
      const token = req.cookies?.accessToken;
      if (!token) {
        return res.status(401).json({ success: false, message: "Authentication required." });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: "school-management-api",
        audience: "school-management-client",
        algorithms: ["HS256"],
      });

      const user = decoded.sub ? await User.findById(decoded.sub) : null;

      if (!user || !user.isActive || decoded.tv !== user.tokenVersion) {
        return res.status(401).json({
          success: false,
          message: "Your session is invalid or your account is inactive.",
        });
      }

      if (user.mustChangePassword && !allowTempPassword) {
        return res.status(403).json({
          success: false,
          code: "PASSWORD_CHANGE_REQUIRED",
          message: "You must change your temporary password first.",
        });
      }

      req.user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      };
      next();
    } catch (error) {
      if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name)) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired session. Please log in again.",
        });
      }
      next(error);
    }
  };
}

const protect = authenticate();
const protectAllowTemp = authenticate({ allowTempPassword: true });

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }
    next();
  };
}

module.exports = { protect, protectAllowTemp, authorize };