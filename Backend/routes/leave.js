import express from "express";
import authorize from "../middlewares/authorize.js";
import {
  createLeave,
  listLeaves,
  reviewLeave,
  updateLeave,
  deleteLeave,
} from "../controllers/leaveController.js";
import { ALL_STAFF_ROLES, MANAGER_AND_ABOVE } from "../utils/roles.js";

const router = express.Router();

router.post("/", authorize(ALL_STAFF_ROLES), createLeave);
router.get("/", authorize(ALL_STAFF_ROLES), listLeaves);
router.patch("/:id/review", authorize(MANAGER_AND_ABOVE), reviewLeave);
router.patch("/:id", authorize(ALL_STAFF_ROLES), updateLeave);
router.delete("/:id", authorize(ALL_STAFF_ROLES), deleteLeave);

export default router;
