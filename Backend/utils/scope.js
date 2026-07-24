import Employee from "../models/Employee.js";
import {
  isOrgWide,
  ROLES,
  SCOPE_LEVELS,
  MANAGER_AND_ABOVE,
  canAssignOrganizationScope,
} from "./roles.js";

/** Normalize ObjectId / populated ref / string to a comparable id string */
export function toIdString(val) {
  if (val == null || val === "") return "";
  if (typeof val === "object") {
    // Populated document: prefer nested _id
    if (val._id != null && val._id !== val) return toIdString(val._id);
    // mongoose ObjectId
    if (typeof val.toHexString === "function") return val.toHexString();
    if (typeof val.toString === "function") {
      const s = val.toString();
      if (s && s !== "[object Object]") return s;
    }
    return "";
  }
  return String(val);
}

/**
 * Build a Mongo filter for Employee queries based on the requester's role + scope.
 */
export function employeeScopeFilter(user) {
  if (!user) return { _id: null };

  const role = String(user.role || "").toLowerCase();
  const scopeLevel = String(user.scopeLevel || "").toLowerCase();

  // Super Admin and organization-wide accounts see everyone
  if (
    role === ROLES.SUPERADMIN ||
    scopeLevel === SCOPE_LEVELS.ORGANIZATION ||
    isOrgWide({ ...user, role, scopeLevel })
  ) {
    return {};
  }

  if (scopeLevel === SCOPE_LEVELS.SECTOR && user.sectorId) {
    return { sectorId: user.sectorId };
  }

  if (scopeLevel === SCOPE_LEVELS.SUB_SECTOR && user.subSectorId) {
    return { subSectorId: user.subSectorId };
  }

  if (scopeLevel === SCOPE_LEVELS.SUB_SUB_SECTOR && user.subSubSectorId) {
    return { subSubSectorId: user.subSubSectorId };
  }

  // Employees / incomplete privileged scope: only themselves
  const selfId = user._id || user.id;
  return { _id: selfId || null };
}

/** Whether this role manages other people's records (not just self-service). */
export function canManageTeam(user) {
  return MANAGER_AND_ABOVE.includes(user?.role);
}

/**
 * Resolve employee ObjectIds visible to this user (for leave/attendance/payroll filters).
 * Returns null when the user can see everyone (org-wide / superadmin).
 */
export async function getScopedEmployeeIds(user) {
  if (!user) return [];
  if (user.role === ROLES.SUPERADMIN || isOrgWide(user)) {
    return null; // means "all"
  }

  if (!canManageTeam(user)) {
    return [user._id];
  }

  const filter = employeeScopeFilter(user);
  const ids = await Employee.find(filter).select("_id").lean();
  return ids.map((e) => e._id);
}

/**
 * Whether actor can access a target employee document.
 * Handles populated sector refs (objects) as well as raw ObjectIds/strings.
 */
export function canAccessEmployee(actor, target) {
  if (!actor || !target) return false;
  if (actor.role === ROLES.SUPERADMIN || isOrgWide(actor)) return true;

  const targetId = toIdString(target._id || target.id);
  const actorId = toIdString(actor._id || actor.id);
  if (targetId && actorId && targetId === actorId) return true;

  if (actor.scopeLevel === SCOPE_LEVELS.SECTOR && actor.sectorId) {
    return toIdString(target.sectorId) === toIdString(actor.sectorId);
  }

  if (actor.scopeLevel === SCOPE_LEVELS.SUB_SECTOR && actor.subSectorId) {
    return toIdString(target.subSectorId) === toIdString(actor.subSectorId);
  }

  if (actor.scopeLevel === SCOPE_LEVELS.SUB_SUB_SECTOR && actor.subSubSectorId) {
    return (
      toIdString(target.subSubSectorId) === toIdString(actor.subSubSectorId)
    );
  }

  return false;
}

/**
 * Roles an actor is allowed to assign when creating a user.
 */
export function allowedRolesToCreate(actor) {
  if (!actor) return [];
  if (actor.role === ROLES.SUPERADMIN) {
    return [
      ROLES.SUPERADMIN,
      ROLES.ADMIN,
      ROLES.HR,
      ROLES.SECTOR_LEAD,
      ROLES.MANAGER,
      ROLES.UNIT_MANAGER,
      ROLES.EMPLOYEE,
    ];
  }
  // Org Admin / Org HR — org roles + Sector Lead + unit staff
  if (
    (actor.role === ROLES.ADMIN || actor.role === ROLES.HR) &&
    isOrgWide(actor)
  ) {
    return [
      ROLES.ADMIN,
      ROLES.HR,
      ROLES.SECTOR_LEAD,
      ROLES.MANAGER,
      ROLES.UNIT_MANAGER,
      ROLES.EMPLOYEE,
    ];
  }
  // Sector Lead — managers, unit managers & employees inside their sector
  if (actor.role === ROLES.SECTOR_LEAD) {
    return [ROLES.MANAGER, ROLES.UNIT_MANAGER, ROLES.EMPLOYEE];
  }
  // Sub-sector Manager may create unit managers + employees under their unit
  if (actor.role === ROLES.MANAGER) {
    return [ROLES.UNIT_MANAGER, ROLES.EMPLOYEE];
  }
  if (actor.role === ROLES.UNIT_MANAGER) {
    return [ROLES.EMPLOYEE];
  }
  return [];
}

/**
 * Whether a new hire's placement stays inside the actor's organizational scope.
 */
export function placementWithinActorScope(actor, { placement, isOrgRole }) {
  if (!actor) return false;
  if (actor.role === ROLES.SUPERADMIN || isOrgWide(actor)) {
    if (isOrgRole) return canAssignOrganizationScope(actor);
    return true;
  }
  if (isOrgRole) return false;
  if (!placement) return false;

  if (actor.scopeLevel === SCOPE_LEVELS.SECTOR && actor.sectorId) {
    return toIdString(placement.sectorId) === toIdString(actor.sectorId);
  }
  if (actor.scopeLevel === SCOPE_LEVELS.SUB_SECTOR && actor.subSectorId) {
    return toIdString(placement.subSectorId) === toIdString(actor.subSectorId);
  }
  if (actor.scopeLevel === SCOPE_LEVELS.SUB_SUB_SECTOR && actor.subSubSectorId) {
    return (
      toIdString(placement.subSubSectorId) ===
      toIdString(actor.subSubSectorId)
    );
  }
  return false;
}
