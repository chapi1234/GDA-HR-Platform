export const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  HR: "hr",
  SECTOR_LEAD: "sector_lead",
  MANAGER: "manager",
  /** Leads a nested unit under a sub-sector (sub-sub-sector) */
  UNIT_MANAGER: "unit_manager",
  EMPLOYEE: "employee",
};

export const SCOPE_LEVELS = {
  ORGANIZATION: "organization",
  SECTOR: "sector",
  SUB_SECTOR: "sub_sector",
  SUB_SUB_SECTOR: "sub_sub_sector",
};

/** Anyone who can access the staff portal */
export const ALL_STAFF_ROLES = [
  ROLES.EMPLOYEE,
  ROLES.UNIT_MANAGER,
  ROLES.MANAGER,
  ROLES.SECTOR_LEAD,
  ROLES.HR,
  ROLES.ADMIN,
  ROLES.SUPERADMIN,
];

/** Full HR ops (payroll, recruitment, devices, etc.) */
export const HR_AND_ABOVE = [
  ROLES.SECTOR_LEAD,
  ROLES.HR,
  ROLES.ADMIN,
  ROLES.SUPERADMIN,
];

/** Includes managers (leave review, unit oversight) */
export const MANAGER_AND_ABOVE = [
  ROLES.UNIT_MANAGER,
  ROLES.MANAGER,
  ROLES.SECTOR_LEAD,
  ROLES.HR,
  ROLES.ADMIN,
  ROLES.SUPERADMIN,
];

/** Can manage org structure deletes / org admin tools */
export const ADMIN_AND_ABOVE = [ROLES.ADMIN, ROLES.SUPERADMIN];

/** Device inventory CRUD (create/edit/delete) — org-wide roles only.
 *  Sector leads can still view and assign within their scope. */
export const DEVICE_INVENTORY_ROLES = [ROLES.HR, ROLES.ADMIN, ROLES.SUPERADMIN];

export const PRIVILEGED_ROLES = [
  ROLES.SUPERADMIN,
  ROLES.ADMIN,
  ROLES.HR,
  ROLES.SECTOR_LEAD,
  ROLES.MANAGER,
  ROLES.UNIT_MANAGER,
];

/** Admin and HR are organization-wide only; Sector Lead owns a sector */
export function isOrganizationOnlyRole(role) {
  return role === ROLES.ADMIN || role === ROLES.HR || role === ROLES.SUPERADMIN;
}

export function isOrgWide(user) {
  const role = user?.role;
  return (
    role === ROLES.SUPERADMIN ||
    role === ROLES.ADMIN ||
    role === ROLES.HR ||
    user?.scopeLevel === SCOPE_LEVELS.ORGANIZATION
  );
}

export function canManageHrOps(user) {
  return HR_AND_ABOVE.includes(user?.role);
}

/** Org tree create/update — Super Admin, Org Admin, Org HR */
export function canManageOrgStructure(user) {
  if (!user) return false;
  if (user.role === ROLES.SUPERADMIN) return true;
  return (
    (user.role === ROLES.ADMIN || user.role === ROLES.HR) && isOrgWide(user)
  );
}

/** May create organization-wide accounts */
export function canAssignOrganizationScope(user) {
  if (!user) return false;
  if (user.role === ROLES.SUPERADMIN) return true;
  return (
    (user.role === ROLES.ADMIN || user.role === ROLES.HR) && isOrgWide(user)
  );
}

export function buildAuthTokenPayload(user) {
  const role = user.role;
  let scopeLevel = user.scopeLevel || SCOPE_LEVELS.SUB_SECTOR;
  if (role === ROLES.SUPERADMIN || role === ROLES.ADMIN || role === ROLES.HR) {
    scopeLevel = SCOPE_LEVELS.ORGANIZATION;
  } else if (role === ROLES.SECTOR_LEAD) {
    scopeLevel = SCOPE_LEVELS.SECTOR;
  } else if (role === ROLES.MANAGER) {
    scopeLevel = SCOPE_LEVELS.SUB_SECTOR;
  } else if (role === ROLES.UNIT_MANAGER) {
    scopeLevel = SCOPE_LEVELS.SUB_SUB_SECTOR;
  }

  return {
    _id: user._id,
    id: user._id,
    role,
    scopeLevel,
    sectorId: user.sectorId || null,
    subSectorId: user.subSectorId || null,
    subSubSectorId: user.subSubSectorId || null,
  };
}

/** Strip sensitive fields from employee docs before sending to clients */
export function sanitizeUser(user) {
  if (!user) return user;
  const obj = typeof user.toObject === "function" ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.otp;
  delete obj.otpExpiry;
  const pathFrom = (ref) =>
    ref?.pathNames?.length ? ref.pathNames.join(" › ") : ref?.name || null;
  obj.unitPath =
    pathFrom(obj.subSubSectorId) ||
    pathFrom(obj.subSectorId) ||
    pathFrom(obj.sectorId) ||
    (obj.scopeLevel === SCOPE_LEVELS.ORGANIZATION || obj.role === ROLES.SUPERADMIN
      ? "Organization"
      : null);
  return obj;
}
