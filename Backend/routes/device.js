import express from "express";
import {
  getDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  searchDevices,
  assignDevice,
  returnDevice,
  getMyDevices,
  approveAssignment,
  rejectAssignment,
} from "../controllers/deviceController.js";
import authorize from "../middlewares/authorize.js";
import {
  ALL_STAFF_ROLES,
  HR_AND_ABOVE,
  DEVICE_INVENTORY_ROLES,
} from "../utils/roles.js";

const router = express.Router();

// View (scoped) — HR and above, including sector leads
router.get("/me", authorize(ALL_STAFF_ROLES), getMyDevices);
router.get("/search", authorize(HR_AND_ABOVE), searchDevices);
router.get("/", authorize(HR_AND_ABOVE), getDevices);
router.get("/:id", authorize(HR_AND_ABOVE), getDeviceById);

// Inventory CRUD — org-wide HR/Admin/Superadmin only
router.post("/", authorize(DEVICE_INVENTORY_ROLES), createDevice);
router.put("/:id", authorize(DEVICE_INVENTORY_ROLES), updateDevice);
router.delete("/:id", authorize(DEVICE_INVENTORY_ROLES), deleteDevice);

// Assignment — HR and above; sector leads limited to their scope (checked in controller)
router.post("/:id/assign", authorize(HR_AND_ABOVE), assignDevice);
router.post("/:id/return", authorize(HR_AND_ABOVE), returnDevice);

// Approve / reject pending assignments — org-wide HR/Admin/Superadmin only
router.post("/:id/approve", authorize(DEVICE_INVENTORY_ROLES), approveAssignment);
router.post("/:id/reject", authorize(DEVICE_INVENTORY_ROLES), rejectAssignment);

export default router;
