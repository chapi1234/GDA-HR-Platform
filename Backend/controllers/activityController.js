import Activity from "../models/Activity.js";
import Employee from "../models/Employee.js";
import {
  canAccessEmployee,
  canManageTeam,
  getScopedEmployeeIds,
  toIdString,
} from "../utils/scope.js";
import { activitySinceDate } from "../utils/logActivity.js";
import { SCOPE_LEVELS } from "../utils/roles.js";

function mapActivity(a) {
  const metaName = a.meta?.employeeName || "";
  return {
    id: a._id,
    actorName: a.actor?.name || metaName || "",
    actorId: a.actor?._id || a.meta?.removedId || null,
    actorAvatar:
      a.actor?.profileImage ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        a.actor?.name || metaName || ""
      )}&background=3b82f6&color=fff`,
    action: a.action,
    type: a.type,
    meta: a.meta || {},
    createdAt: a.createdAt,
  };
}

// Create a new activity (used by other controllers when something happens)
export const createActivity = async (req, res) => {
  try {
    const { actorId, action, type, meta } = req.body;
    const activity = new Activity({
      actor: actorId || req.user?._id || req.user?.id,
      action,
      type,
      meta,
    });
    await activity.save();
    const populated = await activity.populate({
      path: "actor",
      select: "name profileImage employeeId",
    });
    return res.status(201).json({
      status: true,
      message: "Activity created",
      data: mapActivity(populated),
    });
  } catch (err) {
    console.error("createActivity error", err);
    return res.status(500).json({
      status: false,
      message: "Failed to create activity",
      error: err.message,
    });
  }
};

/**
 * List recent activities scoped by role, limited to the last N days (default 7).
 * Query: limit, skip, mine=true, actorId=<id>, days=7
 */
export const listActivities = async (req, res) => {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 10);
    const skip = Number(req.query.skip) || 0;
    const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
    const uid = req.user?._id || req.user?.id;
    if (!uid) {
      return res.status(401).json({ status: false, message: "Unauthorized" });
    }

    const q = {
      createdAt: { $gte: activitySinceDate(days) },
    };

    if (String(req.query.mine) === "true") {
      q.actor = uid;
    } else if (req.query.actorId) {
      const target = await Employee.findById(req.query.actorId).select(
        "sectorId subSectorId subSubSectorId scopeLevel role"
      );
      if (!target || !canAccessEmployee(req.user, target)) {
        return res.status(403).json({
          status: false,
          message: "You can only view activities within your organizational unit",
        });
      }
      q.actor = req.query.actorId;
    } else if (!canManageTeam(req.user)) {
      q.actor = uid;
    } else {
      const scopedIds = await getScopedEmployeeIds(req.user);
      if (scopedIds !== null) {
        const or = [{ actor: { $in: scopedIds } }];
        // Removals may be logged by HR outside the unit — still show via placement meta
        const scopeLevel = String(req.user.scopeLevel || "").toLowerCase();
        if (
          scopeLevel === SCOPE_LEVELS.SUB_SUB_SECTOR &&
          req.user.subSubSectorId
        ) {
          or.push({
            type: "employee",
            "meta.subSubSectorId": toIdString(req.user.subSubSectorId),
          });
        } else if (
          scopeLevel === SCOPE_LEVELS.SUB_SECTOR &&
          req.user.subSectorId
        ) {
          or.push({
            type: "employee",
            "meta.subSectorId": toIdString(req.user.subSectorId),
          });
        } else if (scopeLevel === SCOPE_LEVELS.SECTOR && req.user.sectorId) {
          or.push({
            type: "employee",
            "meta.sectorId": toIdString(req.user.sectorId),
          });
        }
        q.$or = or;
      }
    }

    const activities = await Activity.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: "actor", select: "name profileImage employeeId" });

    return res.status(200).json({
      status: true,
      message: "Activities fetched",
      data: activities.map(mapActivity),
      meta: { days },
    });
  } catch (err) {
    console.error("listActivities error", err);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch activities",
      error: err.message,
    });
  }
};
