import multer from "multer";

/**
 * Wrap multer so Cloudinary plain-object errors become clear JSON responses
 * (avoids Express logging "[object Object]").
 */
export function withUploadErrorHandler(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next();
      const message =
        err.message ||
        err.error?.message ||
        (typeof err === "string" ? err : null) ||
        "File upload failed";
      const httpCode = err.http_code || err.status;
      console.error("upload error:", message, httpCode || err.code || "");

      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          status: false,
          message: "File too large",
        });
      }

      if (
        httpCode === 401 ||
        /api_key|Invalid cloud_name|Must supply|Unauthorized/i.test(message)
      ) {
        return res.status(502).json({
          status: false,
          message:
            "Cloudinary rejected the upload. Save Backend/.env with valid CLOUDINARY_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_SECRET_KEY (from Console → Settings → API Keys), then restart the server.",
        });
      }

      return res.status(500).json({ status: false, message });
    });
  };
}

export default withUploadErrorHandler;
