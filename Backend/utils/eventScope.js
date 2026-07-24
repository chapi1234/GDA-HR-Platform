import { ROLES, SCOPE_LEVELS, isOrgWide } from "./roles.js";

/**
 * Mongo filter: events the viewer is allowed to see.
 * Org-wide roles see everything.
 * Sector Lead sees org + everything in their sector.
 * Manager/Employee see org + their sector announcements + their unit announcements.
 */
export function buildEventVisibilityFilter(user) {
  if (!user) return { _id: null };

  if (user.role === ROLES.SUPERADMIN || isOrgWide(user)) {
    return {};
  }

  const or = [
    { visibilityScope: SCOPE_LEVELS.ORGANIZATION },
    // Legacy events without scope → treat as org-wide
    { visibilityScope: { $exists: false } },
    { visibilityScope: null },
  ];

  // Sector Lead: anything tagged to their sector (any depth)
  if (user.role === ROLES.SECTOR_LEAD && user.sectorId) {
    or.push({ sectorId: user.sectorId });
    return { $or: or };
  }

  if (user.sectorId) {
    or.push({
      visibilityScope: SCOPE_LEVELS.SECTOR,
      sectorId: user.sectorId,
    });
  }

  if (user.subSectorId) {
    or.push({
      visibilityScope: SCOPE_LEVELS.SUB_SECTOR,
      subSectorId: user.subSectorId,
    });
  }

  if (user.subSubSectorId) {
    or.push({
      visibilityScope: SCOPE_LEVELS.SUB_SUB_SECTOR,
      subSubSectorId: user.subSubSectorId,
    });
  }

  return { $or: or };
}

/**
 * Placement + visibility for a new event created by this actor.
 */
export function resolveEventAudience(actor) {
  if (!actor) {
    return { error: "Not authenticated" };
  }

  if (
    actor.role === ROLES.SUPERADMIN ||
    ((actor.role === ROLES.ADMIN || actor.role === ROLES.HR) &&
      isOrgWide(actor))
  ) {
    return {
      visibilityScope: SCOPE_LEVELS.ORGANIZATION,
      sectorId: null,
      subSectorId: null,
      subSubSectorId: null,
      room: "org",
      audienceLabel: "Organization-wide",
    };
  }

  if (actor.role === ROLES.SECTOR_LEAD) {
    if (!actor.sectorId) {
      return { error: "Sector Lead must be assigned to a sector" };
    }
    const sectorId = String(actor.sectorId);
    return {
      visibilityScope: SCOPE_LEVELS.SECTOR,
      sectorId,
      subSectorId: null,
      subSubSectorId: null,
      room: `sector:${sectorId}`,
      audienceLabel: "Your sector",
    };
  }

  if (actor.role === ROLES.MANAGER) {
    if (!actor.subSectorId) {
      return { error: "Manager must be assigned to a sub-sector" };
    }
    const subSectorId = String(actor.subSectorId);
    return {
      visibilityScope: SCOPE_LEVELS.SUB_SECTOR,
      sectorId: actor.sectorId ? String(actor.sectorId) : null,
      subSectorId,
      subSubSectorId: null,
      room: `sub_sector:${subSectorId}`,
      audienceLabel: "Your sub-sector",
    };
  }

  if (actor.role === ROLES.UNIT_MANAGER) {
    if (!actor.subSubSectorId) {
      return { error: "Unit Manager must be assigned to a sub-sub-sector" };
    }
    const subSubSectorId = String(actor.subSubSectorId);
    return {
      visibilityScope: SCOPE_LEVELS.SUB_SUB_SECTOR,
      sectorId: actor.sectorId ? String(actor.sectorId) : null,
      subSectorId: actor.subSectorId ? String(actor.subSectorId) : null,
      subSubSectorId,
      room: `sub_sub_sector:${subSubSectorId}`,
      audienceLabel: "Your unit",
    };
  }

  return { error: "You cannot post calendar announcements" };
}

export function socketRoomsForUser(user) {
  const rooms = ["org"];
  if (!user) return rooms;

  // Org Admin / Org HR / Super Admin receive every announcement live
  if (user.role === ROLES.SUPERADMIN || isOrgWide(user)) {
    rooms.push("org_watch");
  }

  if (user.sectorId) rooms.push(`sector:${String(user.sectorId)}`);
  if (user.subSectorId) rooms.push(`sub_sector:${String(user.subSectorId)}`);
  if (user.subSubSectorId) {
    rooms.push(`sub_sub_sector:${String(user.subSubSectorId)}`);
  }
  if (user.role === ROLES.SECTOR_LEAD && user.sectorId) {
    rooms.push(`sector_lead:${String(user.sectorId)}`);
  }
  return rooms;
}

/** Extra rooms to notify (Sector Lead + org watchers for non-org posts) */
export function extraEmitRooms(audience) {
  const rooms = [];
  if (audience?.visibilityScope !== SCOPE_LEVELS.ORGANIZATION) {
    rooms.push("org_watch");
  }
  if (
    audience?.sectorId &&
    (audience.visibilityScope === SCOPE_LEVELS.SUB_SECTOR ||
      audience.visibilityScope === SCOPE_LEVELS.SUB_SUB_SECTOR)
  ) {
    rooms.push(`sector_lead:${String(audience.sectorId)}`);
  }
  return rooms;
}
