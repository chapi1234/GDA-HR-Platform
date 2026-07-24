import express from "express";
import authorize from "../middlewares/authorize.js";
import {
  createJob,
  listJobs,
  getJob,
  updateJob,
  deleteJob,
} from "../controllers/jobController.js";
import { HR_AND_ABOVE } from "../utils/roles.js";

const router = express.Router();

router.get("/", listJobs);
router.get("/:id", getJob);

router.post("/", authorize(HR_AND_ABOVE), createJob);
router.patch("/:id", authorize(HR_AND_ABOVE), updateJob);
router.delete("/:id", authorize(HR_AND_ABOVE), deleteJob);

export default router;
