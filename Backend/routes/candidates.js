import express from "express";
import upload from "../config/multer.js";
import authorize from "../middlewares/authorize.js";
import { withUploadErrorHandler } from "../middlewares/uploadError.js";
import {
  registerCandidate,
  loginCandidate,
  getMe,
  updateProfile,
  applyToJob,
  listCandidates,
  updateApplicationStatus,
} from "../controllers/candidateController.js";
import { HR_AND_ABOVE } from "../utils/roles.js";

const router = express.Router();

router.post("/register", registerCandidate);
router.post("/login", loginCandidate);
router.get("/", authorize(HR_AND_ABOVE), listCandidates);
router.get("/me", authorize(), getMe);
router.patch("/profile", authorize(), updateProfile);
router.post("/apply", withUploadErrorHandler(upload.single("resume")), applyToJob);
router.patch(
  "/applications/:id/status",
  authorize(HR_AND_ABOVE),
  updateApplicationStatus
);

export default router;
