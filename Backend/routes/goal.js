import express from "express";
import {
  getGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
} from "../controllers/goalController.js";
import authorize from "../middlewares/authorize.js";
import { ALL_STAFF_ROLES } from "../utils/roles.js";

const router = express.Router();

router.get("/", authorize(ALL_STAFF_ROLES), getGoals);
router.get("/:id", authorize(ALL_STAFF_ROLES), getGoalById);
router.post("/", authorize(ALL_STAFF_ROLES), createGoal);
router.put("/:id", authorize(ALL_STAFF_ROLES), updateGoal);
router.delete("/:id", authorize(ALL_STAFF_ROLES), deleteGoal);

export default router;
