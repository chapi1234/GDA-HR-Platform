import express from "express";
import {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  editEmployee,
  deleteEmployee,
  resumeUpload,
  profileUpload,
} from "../controllers/employeeController.js";
import authorize from "../middlewares/authorize.js";
import upload from "../config/multer.js";
import uploadProfile from "../config/multerProfile.js";
import { withUploadErrorHandler } from "../middlewares/uploadError.js";
import {
  ALL_STAFF_ROLES,
  HR_AND_ABOVE,
  MANAGER_AND_ABOVE,
} from "../utils/roles.js";

const router = express.Router();

router.get("/", authorize(MANAGER_AND_ABOVE), getAllEmployees);
router.get("/:id", authorize(ALL_STAFF_ROLES), getEmployeeById);
router.post("/create", authorize(MANAGER_AND_ABOVE), createEmployee);
router.put("/update/:id", authorize(ALL_STAFF_ROLES), updateEmployee);
router.put("/edit/:id", authorize(MANAGER_AND_ABOVE), editEmployee);
router.delete("/delete/:id", authorize(HR_AND_ABOVE), deleteEmployee);
router.put(
  "/upload-resume/:id",
  authorize(ALL_STAFF_ROLES),
  withUploadErrorHandler(upload.single("resume")),
  resumeUpload
);
router.put(
  "/upload-profile/:id",
  authorize(ALL_STAFF_ROLES),
  withUploadErrorHandler(uploadProfile.single("profile")),
  profileUpload
);

export default router;
