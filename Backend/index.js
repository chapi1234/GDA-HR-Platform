import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import morgan from "morgan";
import helmet from "helmet";
import connectDB from "./config/DBconnect.js";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import employeeRoutes from "./routes/employee.js";
import departmentRoutes from "./routes/department.js";
import eventRoutes from "./routes/event.js";
import goalRoutes from "./routes/goal.js";
import attendanceRoutes from "./routes/attendance.js";
import activityRoutes from "./routes/activity.js";
import leaveRoutes from "./routes/leave.js";
import payrollRoutes from "./routes/payroll.js";
import payslipRoutes from "./routes/payslip.js";
import salaryAdvanceRoutes from "./routes/salaryAdvance.js";
import notificationRoutes from "./routes/notification.js";
import jobRoutes from "./routes/jobs.js";
import candidateRoutes from "./routes/candidates.js";
import deviceRoutes from "./routes/device.js";
import sectorRoutes from "./routes/sector.js";
import chatRoutes from "./routes/chat.js";
import { initSocket } from "./socket.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
connectDB();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const corsOrigins = [
  "https://gammoda.vercel.app",
  "http://localhost:8080",
  "http://localhost:3000",
  "https://gammoda-public-portifolio.vercel.app",
];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cookieParser());

// Chat attachments (and other local files)
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders(res) {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/sectors", sectorRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/payslips", payslipRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/salary-advances", salaryAdvanceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/chat", chatRoutes);

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
