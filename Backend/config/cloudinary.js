// config/cloudinary.js
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Always load Backend/.env (not whatever cwd nodemon started in)
const envPath = path.join(__dirname, "..", ".env");
dotenv.config({ path: envPath, override: true });

const cloud_name = String(process.env.CLOUDINARY_NAME || "").trim();
const api_key = String(process.env.CLOUDINARY_API_KEY || "").trim();
const api_secret = String(process.env.CLOUDINARY_SECRET_KEY || "").trim();

cloudinary.config({ cloud_name, api_key, api_secret });

console.log("✅ Cloudinary loaded from:", envPath);
console.log(
  "   cloud_name:",
  cloud_name || "(missing)",
  "| api_key ends:",
  api_key ? api_key.slice(-4) : "(missing)",
  "| secret length:",
  api_secret ? api_secret.length : 0
);

export default cloudinary;
