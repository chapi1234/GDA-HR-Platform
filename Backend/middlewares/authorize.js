import jwt from "jsonwebtoken";

export default function authorize(roles = []) {
  if (typeof roles === "string") {
    roles = [roles];
  }

  return (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          status: "failed",
          message: "Not authorized, token missing",
        });
      }

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({
          status: "failed",
          message: "Access denied: insufficient permissions",
        });
      }

      req.user = decoded;
      next();
    } catch (err) {
      console.error("authorize error:", err?.message || err);
      if (
        err &&
        (err.name === "JsonWebTokenError" ||
          err.message === "invalid signature" ||
          err.name === "TokenExpiredError")
      ) {
        return res.status(401).json({
          status: "failed",
          message: "Invalid or expired token",
        });
      }
      res.status(500).json({ status: "failed", message: "Internal server error" });
    }
  };
}
