import express from "express";
import authorize from "../middlewares/authorize.js";
import {
  createEvent,
  getEvents,
  searchEvents,
  getEventsByDate,
  getUpcomingEvents,
  getRecentAnnouncements,
  getEventById,
  updateEvent,
  deleteEvent,
} from "../controllers/eventController.js";
import {
  ALL_STAFF_ROLES,
  MANAGER_AND_ABOVE,
} from "../utils/roles.js";

const router = express.Router();

router.get("/", authorize(ALL_STAFF_ROLES), getEvents);
router.get("/search", authorize(ALL_STAFF_ROLES), searchEvents);
router.get("/date/:date", authorize(ALL_STAFF_ROLES), getEventsByDate);
router.get("/upcoming", authorize(ALL_STAFF_ROLES), getUpcomingEvents);
router.get(
  "/announcements/recent",
  authorize(ALL_STAFF_ROLES),
  getRecentAnnouncements
);
router.get("/:id", authorize(ALL_STAFF_ROLES), getEventById);

router.post("/", authorize(MANAGER_AND_ABOVE), createEvent);
router.put("/:id", authorize(MANAGER_AND_ABOVE), updateEvent);
router.delete("/:id", authorize(MANAGER_AND_ABOVE), deleteEvent);

export default router;
