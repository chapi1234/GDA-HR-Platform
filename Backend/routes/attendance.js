import express from "express";
import authorize from "../middlewares/authorize.js";
import {
  listByDate,
  myHistory,
  checkIn,
  checkOut,
  upsert,
  statsByDate,
  monthlyReport,
} from "../controllers/attendanceController.js";
import { ALL_STAFF_ROLES, HR_AND_ABOVE, MANAGER_AND_ABOVE } from "../utils/roles.js";

const router = express.Router();

router.get("/", authorize(MANAGER_AND_ABOVE), listByDate);
router.get("/monthly-report", authorize(MANAGER_AND_ABOVE), monthlyReport);
router.get("/me", authorize(ALL_STAFF_ROLES), myHistory);
router.get("/stats", authorize(ALL_STAFF_ROLES), statsByDate);
router.post("/check-in", authorize(ALL_STAFF_ROLES), checkIn);
router.post("/check-out", authorize(ALL_STAFF_ROLES), checkOut);
router.post("/upsert", authorize(HR_AND_ABOVE), upsert);

export default router;
