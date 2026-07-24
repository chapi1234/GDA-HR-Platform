import express from "express";
import authorize from "../middlewares/authorize.js";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notificationController.js";
import { ALL_STAFF_ROLES } from "../utils/roles.js";

const router = express.Router();

router.get("/me", authorize(ALL_STAFF_ROLES), getMyNotifications);
router.patch("/me/read-all", authorize(ALL_STAFF_ROLES), markAllNotificationsRead);
router.patch("/:id/read", authorize(ALL_STAFF_ROLES), markNotificationRead);

export default router;
