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
} from "../controllers/deviceController.js";
import authorize from "../middlewares/authorize.js";
import { ALL_STAFF_ROLES, HR_AND_ABOVE } from "../utils/roles.js";

const router = express.Router();

router.get("/me", authorize(ALL_STAFF_ROLES), getMyDevices);
router.get("/search", authorize(HR_AND_ABOVE), searchDevices);
router.get("/", authorize(HR_AND_ABOVE), getDevices);
router.get("/:id", authorize(HR_AND_ABOVE), getDeviceById);
router.post("/", authorize(HR_AND_ABOVE), createDevice);
router.put("/:id", authorize(HR_AND_ABOVE), updateDevice);
router.delete("/:id", authorize(HR_AND_ABOVE), deleteDevice);
router.post("/:id/assign", authorize(HR_AND_ABOVE), assignDevice);
router.post("/:id/return", authorize(HR_AND_ABOVE), returnDevice);

export default router;
