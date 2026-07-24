import express from "express";
import authorize from "../middlewares/authorize.js";
import {
  createAdvance,
  getAdvances,
  getOpenAdvancesForEmployee,
  updateAdvance,
  cancelAdvance,
} from "../controllers/salaryAdvanceController.js";
import { ALL_STAFF_ROLES, ROLES } from "../utils/roles.js";

const router = express.Router();

const CREATORS = [ROLES.MANAGER, ROLES.HR];
const MUTATORS = [ROLES.MANAGER, ROLES.HR];

router.post("/", authorize(CREATORS), createAdvance);
router.get("/", authorize(ALL_STAFF_ROLES), getAdvances);
router.get(
  "/open/:employeeId",
  authorize([...CREATORS, ROLES.SECTOR_LEAD, ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.UNIT_MANAGER]),
  getOpenAdvancesForEmployee
);
router.patch("/:id", authorize(MUTATORS), updateAdvance);
router.patch("/:id/cancel", authorize(MUTATORS), cancelAdvance);

export default router;
