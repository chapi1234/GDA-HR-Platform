import express from "express";
import {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  searchDepartments,
  getDepartmentsPublicList,
} from "../controllers/departmentController.js";
import authorize from "../middlewares/authorize.js";
import { ALL_STAFF_ROLES, HR_AND_ABOVE } from "../utils/roles.js";

const router = express.Router();

router.get("/public-list", getDepartmentsPublicList);
router.get("/", authorize(ALL_STAFF_ROLES), getAllDepartments);
router.get("/search", authorize(ALL_STAFF_ROLES), searchDepartments);
router.get("/:id", authorize(ALL_STAFF_ROLES), getDepartmentById);
router.post("/", authorize(HR_AND_ABOVE), createDepartment);
router.put("/:id", authorize(HR_AND_ABOVE), updateDepartment);
router.delete("/:id", authorize(HR_AND_ABOVE), deleteDepartment);

export default router;
