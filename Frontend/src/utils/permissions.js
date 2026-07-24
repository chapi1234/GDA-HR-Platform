/** Shared role / capability helpers for the HR portal */

export const ROLE_LABELS = {
  superadmin: "Super Admin",
  admin: "Org Admin",
  hr: "Org HR",
  sector_lead: "Sector Lead",
  manager: "Manager",
  unit_manager: "Unit Manager",
  employee: "Employee",
};

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || "User";
}

export function buildCapabilities(user) {
  const role = user?.role || null;
  const scopeLevel = user?.scopeLevel || null;
  const isSuperAdmin = role === "superadmin";
  const isAdmin = role === "admin";
  const isHR = role === "hr";
  const isSectorLead = role === "sector_lead";
  const isManager = role === "manager";
  const isUnitManager = role === "unit_manager";
  const isEmployee = role === "employee";
  const isOrgWide =
    isSuperAdmin ||
    scopeLevel === "organization" ||
    isAdmin ||
    isHR;

  const canManage = [
    "unit_manager",
    "manager",
    "sector_lead",
    "hr",
    "admin",
    "superadmin",
  ].includes(role);
  const canManageHrOps = [
    "sector_lead",
    "hr",
    "admin",
    "superadmin",
  ].includes(role);
  /** View payroll sheet / team salary list (not employees' self-only view) */
  const canViewPayrollOps = [
    "manager",
    "unit_manager",
    "sector_lead",
    "hr",
    "admin",
    "superadmin",
  ].includes(role);
  /** Anyone on the portal can view their advances (ops see scoped team; employees see own) */
  const canViewSalaryAdvances = !!role;
  /** Sub-sector Manager or Org HR may create rows */
  const canCreatePayroll =
    role === "manager" || (role === "hr" && isOrgWide);
  /** Only Managers may edit/delete pending records (UI); Org HR uses approve */
  const canEditPayroll = role === "manager";
  const canDeletePayroll = role === "manager";
  /** Only Org HR approves / rejects */
  const canApprovePayroll = role === "hr" && isOrgWide;
  /** Super Admin, Org Admin, Sector Lead — list is read-only */
  const payrollReadOnly =
    isSuperAdmin || isAdmin || isSectorLead;
  const canManagePayroll = canViewPayrollOps;
  const canRecruit = canManageHrOps;
  const canManageDevices = canManageHrOps;
  const canReviewLeave = canManage;
  const canManageTeamAttendance = canManage;
  const canManageOrgStructure =
    isSuperAdmin || ((isAdmin || isHR) && isOrgWide);
  const canAccessAdminConsole = isSuperAdmin || (isAdmin && isOrgWide);
  const canAssignOrgWide = isSuperAdmin || ((isAdmin || isHR) && isOrgWide);

  return {
    role,
    scopeLevel,
    isSuperAdmin,
    isAdmin,
    isHR,
    isSectorLead,
    isManager,
    isUnitManager,
    isEmployee,
    isOrgWide,
    canManage,
    canManageHrOps,
    canManagePayroll,
    canViewPayrollOps,
    canViewSalaryAdvances,
    canCreatePayroll,
    canEditPayroll,
    canDeletePayroll,
    canApprovePayroll,
    payrollReadOnly,
    canRecruit,
    canManageDevices,
    canReviewLeave,
    canManageTeamAttendance,
    canManageOrgStructure,
    canAccessAdminConsole,
    canAssignOrgWide,
    roleLabel: getRoleLabel(role),
    sectorId: user?.sectorId || null,
    subSectorId: user?.subSectorId || null,
    subSubSectorId: user?.subSubSectorId || null,
  };
}

/** Roles the current user may assign when creating/editing employees */
export function creatableRolesFor(user) {
  const { role, isOrgWide, isSuperAdmin } = buildCapabilities(user);
  if (isSuperAdmin) {
    return [
      "employee",
      "unit_manager",
      "manager",
      "sector_lead",
      "hr",
      "admin",
      "superadmin",
    ];
  }
  if ((role === "admin" || role === "hr") && isOrgWide) {
    return ["employee", "unit_manager", "manager", "sector_lead", "hr", "admin"];
  }
  if (role === "sector_lead") {
    return ["employee", "unit_manager", "manager"];
  }
  if (role === "manager") {
    return ["employee", "unit_manager"];
  }
  if (role === "unit_manager") {
    return ["employee"];
  }
  return [];
}

export function buildNavigationItems(caps) {
  const {
    canManage,
    canManageHrOps,
    canViewPayrollOps,
    canViewSalaryAdvances,
    canAccessAdminConsole,
  } = caps;

  const selfService = [
    { label: "Dashboard", href: "/dashboard", icon: "Building2" },
    { label: "My Profile", href: "/profile", icon: "User" },
    { label: "Attendance", href: "/attendance", icon: "UserCheck" },
    { label: "My Salary", href: "/salary", icon: "DollarSign" },
    ...(canViewSalaryAdvances
      ? [{ label: "My Advances", href: "/salary-advances", icon: "DollarSign" }]
      : []),
    { label: "My Payslips", href: "/payslips", icon: "DollarSign" },
    { label: "Leave Requests", href: "/leave-requests", icon: "Calendar" },
    { label: "Calendar", href: "/calendar", icon: "Calendar" },
    { label: "My Devices", href: "/my-devices", icon: "Laptop" },
    { label: "Goals", href: "/goals", icon: "Briefcase" },
    { label: "Settings", href: "/settings", icon: "Settings" },
  ];

  if (!canManage) return selfService;

  return [
    { label: "Dashboard", href: "/dashboard", icon: "Building2" },
    ...(canAccessAdminConsole
      ? [{ label: "Admin Console", href: "/admin-console", icon: "Settings" }]
      : []),
    { label: "My Profile", href: "/profile", icon: "User" },
    { label: "Employees", href: "/employees", icon: "Users" },
    { label: "Sectors", href: "/sectors", icon: "Building2" },
    { label: "Attendance", href: "/attendance", icon: "UserCheck" },
    {
      label: canViewPayrollOps ? "Salary / Payroll" : "My Salary",
      href: "/salary",
      icon: "DollarSign",
    },
    ...(canViewSalaryAdvances
      ? [
          {
            label: canViewPayrollOps ? "Salary Advances" : "My Advances",
            href: "/salary-advances",
            icon: "DollarSign",
          },
        ]
      : []),
    ...(canManageHrOps
      ? [{ label: "Payslips", href: "/payslips", icon: "DollarSign" }]
      : [{ label: "My Payslips", href: "/payslips", icon: "DollarSign" }]),
    { label: "Leave Requests", href: "/leave-requests", icon: "Calendar" },
    ...(canManageHrOps
      ? [
          { label: "Recruitment", href: "/recruitment", icon: "Briefcase" },
          {
            label: "Device Management",
            href: "/device-management",
            icon: "Laptop",
          },
        ]
      : [{ label: "My Devices", href: "/my-devices", icon: "Laptop" }]),
    { label: "Calendar", href: "/calendar", icon: "Calendar" },
    { label: "Goals", href: "/goals", icon: "Briefcase" },
    { label: "Settings", href: "/settings", icon: "Settings" },
  ];
}
