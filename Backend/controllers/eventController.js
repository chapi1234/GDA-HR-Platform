import Event from "../models/Event.js";
import Joi from "joi";
import {
  buildEventVisibilityFilter,
  resolveEventAudience,
  extraEmitRooms,
} from "../utils/eventScope.js";
import { emitAnnouncement } from "../socket.js";
import { MANAGER_AND_ABOVE, ROLES } from "../utils/roles.js";

const eventSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().allow("").max(2000),
  date: Joi.alternatives(Joi.string(), Joi.date()).required(),
  time: Joi.string().trim().default("09:00"),
  duration: Joi.number().integer().min(1).max(24 * 60).default(60),
  type: Joi.string()
    .valid("meeting", "holiday", "training", "personal", "announcement", "other")
    .default("meeting"),
  location: Joi.string().allow(""),
  attendees: Joi.array().items(Joi.string().trim()).default([]),
  color: Joi.string().allow(""),
});

const typeToColor = {
  meeting: "bg-blue-500",
  holiday: "bg-red-500",
  training: "bg-purple-500",
  personal: "bg-green-500",
  announcement: "bg-amber-500",
  other: "bg-gray-500",
};

function parseDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const local = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (!Number.isNaN(local.getTime())) return local;
    }
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
    return null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function serializeEvent(doc) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  obj.id = obj._id;
  if (obj.createdBy != null) {
    obj.createdBy =
      typeof obj.createdBy === "object" && obj.createdBy._id
        ? String(obj.createdBy._id)
        : String(obj.createdBy);
  }
  return obj;
}

/** Creator, Org Admin, or Super Admin may update/delete an event. */
function canMutateEvent(user, event) {
  if (!user || !event) return false;
  if (user.role === ROLES.SUPERADMIN || user.role === ROLES.ADMIN) return true;
  const uid = user._id || user.id;
  if (!uid || !event.createdBy) return false;
  const createdBy =
    typeof event.createdBy === "object" && event.createdBy._id
      ? event.createdBy._id
      : event.createdBy;
  return String(createdBy) === String(uid);
}

export const createEvent = async (req, res) => {
  try {
    if (!MANAGER_AND_ABOVE.includes(req.user?.role)) {
      return res.status(403).json({
        status: false,
        message: "Only managers and above can post events",
      });
    }

    const { error, value } = eventSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        status: false,
        message: "Validation failed",
        details: error.details,
      });
    }

    // Unit leads may only post announcements (unit notices)
    if (
      (req.user.role === ROLES.MANAGER ||
        req.user.role === ROLES.UNIT_MANAGER) &&
      value.type !== "announcement"
    ) {
      return res.status(403).json({
        status: false,
        message: "Managers can only post announcements for their unit",
      });
    }

    const audience = resolveEventAudience(req.user);
    if (audience.error) {
      return res.status(403).json({ status: false, message: audience.error });
    }

    const dateParsed = parseDateOnly(value.date);
    if (!dateParsed) {
      return res.status(400).json({ status: false, message: "Invalid date format" });
    }

    const color =
      value.color && value.color.trim().length > 0
        ? value.color
        : typeToColor[value.type] || "bg-gray-500";

    const created = await Event.create({
      title: value.title,
      description: value.description,
      date: dateParsed,
      time: value.time,
      duration: value.duration,
      type: value.type,
      location: value.location,
      attendees: value.attendees || [],
      color,
      visibilityScope: audience.visibilityScope,
      sectorId: audience.sectorId,
      subSectorId: audience.subSectorId,
      subSubSectorId: audience.subSubSectorId,
      createdBy: req.user._id || req.user.id,
    });

    if (value.type === "announcement") {
      const payload = {
        id: String(created._id),
        title: created.title,
        description: created.description || "",
        type: created.type,
        date: created.date,
        time: created.time,
        visibilityScope: created.visibilityScope,
        audienceLabel: audience.audienceLabel,
        createdAt: created.createdAt,
      };
      emitAnnouncement(audience.room, payload);
      for (const room of extraEmitRooms(audience)) {
        emitAnnouncement(room, payload);
      }
    }

    return res.status(201).json({
      status: true,
      message: "Event created",
      data: {
        ...serializeEvent(created),
        audienceLabel: audience.audienceLabel,
        createdByName: req.user.name || null,
      },
    });
  } catch (err) {
    console.error("createEvent error:", err);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};

export const getEvents = async (req, res) => {
  try {
    const { from, to, type, q } = req.query;
    const scopeFilter = buildEventVisibilityFilter(req.user);
    const filter = { ...scopeFilter };

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = startOfDay(parseDateOnly(from));
      if (to) filter.date.$lte = endOfDay(parseDateOnly(to));
    }
    if (type) filter.type = type;
    if (q && String(q).trim().length > 0) {
      const regex = new RegExp(String(q).trim(), "i");
      const textOr = [
        { title: regex },
        { description: regex },
        { location: regex },
      ];
      // Combine scope $or with text search carefully
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: textOr }];
        delete filter.$or;
      } else {
        filter.$or = textOr;
      }
    }

    const events = await Event.find(filter).sort({
      date: 1,
      time: 1,
      createdAt: -1,
    });
    return res.status(200).json({ status: true, data: events.map(serializeEvent) });
  } catch (err) {
    console.error("getEvents error:", err);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};

export const searchEvents = async (req, res) => {
  req.query.q = req.query.q || "";
  return getEvents(req, res);
};

export const getEventsByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const d = parseDateOnly(date);
    if (!d) {
      return res.status(400).json({ status: false, message: "Invalid date" });
    }
    const scopeFilter = buildEventVisibilityFilter(req.user);
    const events = await Event.find({
      ...scopeFilter,
      date: { $gte: startOfDay(d), $lte: endOfDay(d) },
    }).sort({ time: 1 });
    return res.status(200).json({ status: true, data: events.map(serializeEvent) });
  } catch (err) {
    console.error("getEventsByDate error:", err);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};

export const getUpcomingEvents = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 5, 50));
    // Upcoming = starting tomorrow (not today)
    const tomorrow = startOfDay(new Date());
    tomorrow.setDate(tomorrow.getDate() + 1);
    const scopeFilter = buildEventVisibilityFilter(req.user);
    const events = await Event.find({
      ...scopeFilter,
      date: { $gte: tomorrow },
    })
      .sort({ date: 1, time: 1 })
      .limit(limit);
    return res.status(200).json({ status: true, data: events.map(serializeEvent) });
  } catch (err) {
    console.error("getUpcomingEvents error:", err);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};

/** Recent announcements for the notification bell (scoped) */
export const getRecentAnnouncements = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 50));
    const scopeFilter = buildEventVisibilityFilter(req.user);
    const events = await Event.find({
      ...scopeFilter,
      type: "announcement",
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({ path: "createdBy", select: "name role" });

    return res.status(200).json({
      status: true,
      data: events.map((e) => {
        const obj = serializeEvent(e);
        obj.createdByName = e.createdBy?.name || null;
        return obj;
      }),
    });
  } catch (err) {
    console.error("getRecentAnnouncements error:", err);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};

export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ status: false, message: "Event not found" });
    }
    // Soft visibility check
    const visible = await Event.findOne({
      _id: id,
      ...buildEventVisibilityFilter(req.user),
    });
    if (!visible && req.user?.role !== ROLES.SUPERADMIN) {
      return res.status(403).json({ status: false, message: "Access denied" });
    }
    return res.status(200).json({ status: true, data: serializeEvent(event) });
  } catch (err) {
    console.error("getEventById error:", err);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = eventSchema
      .fork(["title", "date"], (s) => s.optional())
      .validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        status: false,
        message: "Validation failed",
        details: error.details,
      });
    }

    const existing = await Event.findById(id);
    if (!existing) {
      return res.status(404).json({ status: false, message: "Event not found" });
    }

    if (!canMutateEvent(req.user, existing)) {
      return res.status(403).json({
        status: false,
        message: "Only the creator, Org Admin, or Super Admin can update this event",
      });
    }

    // Managers / unit managers may only keep announcements when editing
    if (
      (req.user.role === ROLES.MANAGER ||
        req.user.role === ROLES.UNIT_MANAGER) &&
      (value.type || existing.type) !== "announcement"
    ) {
      return res.status(403).json({
        status: false,
        message: "Managers can only manage announcements for their unit",
      });
    }

    const update = { ...value };
    if (update.date) {
      const d = parseDateOnly(update.date);
      if (!d) {
        return res.status(400).json({ status: false, message: "Invalid date format" });
      }
      update.date = d;
    }
    if (!update.color && update.type) {
      update.color = typeToColor[update.type] || "bg-gray-500";
    }

    const updated = await Event.findByIdAndUpdate(id, update, { new: true });
    return res.status(200).json({
      status: true,
      message: "Event updated",
      data: serializeEvent(updated),
    });
  } catch (err) {
    console.error("updateEvent error:", err);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Event.findById(id);
    if (!existing) {
      return res.status(404).json({ status: false, message: "Event not found" });
    }

    if (!canMutateEvent(req.user, existing)) {
      return res.status(403).json({
        status: false,
        message: "Only the creator, Org Admin, or Super Admin can delete this event",
      });
    }

    await Event.findByIdAndDelete(id);
    return res.status(200).json({ status: true, message: "Event deleted" });
  } catch (err) {
    console.error("deleteEvent error:", err);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};
