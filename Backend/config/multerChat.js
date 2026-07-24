import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary.js";

// Same pattern as config/multer.js (resumes) — Cloudinary public URLs
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "chat",
    resource_type: "auto",
    public_id: (req, file) =>
      `${Date.now()}-${(file.originalname || "file").split(".")[0]}`,
  },
});

const uploadChat = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/** Multer + clear Cloudinary error messages */
export function handleChatUpload(field = "files", max = 5) {
  const run = uploadChat.array(field, max);
  return (req, res, next) => {
    run(req, res, (err) => {
      if (!err) return next();
      const message =
        err.message ||
        err.error?.message ||
        (typeof err === "string" ? err : null) ||
        "File upload failed";
      const httpCode = err.http_code || err.status;
      console.error("chat upload error:", message, httpCode || err.code || "");

      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          status: false,
          message: "File too large (max 10MB)",
        });
      }

      if (httpCode === 401 || /api_key|Invalid cloud_name|Must supply/i.test(message)) {
        return res.status(502).json({
          status: false,
          message:
            "Cloudinary rejected the upload. Update CLOUDINARY_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_SECRET_KEY in Backend/.env (Dashboard → Settings → API Keys), then restart the server.",
        });
      }

      return res.status(500).json({ status: false, message });
    });
  };
}

export default uploadChat;
