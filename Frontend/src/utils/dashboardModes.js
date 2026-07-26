/**
 * Dashboard mode config — one mode per exact role.
 * Text fields use i18n keys under `modes.*` and `nav.*`.
 */

export const DASHBOARD_MODES = {
  superadmin: {
    id: "superadmin",
    badgeKey: "modes.superadmin.badge",
    titleKey: "modes.superadmin.title",
    titleFallbackKey: "modes.superadmin.titleFallback",
    subtitleKey: "modes.superadmin.subtitle",
    emphasisKey: "modes.superadmin.emphasis",
    showTeamKpis: true,
    showPayrollKpi: true,
    showUnitChart: true,
    actions: [
      { labelKey: "nav.adminConsole", href: "/admin-console" },
      { labelKey: "nav.employees", href: "/employees" },
      { labelKey: "nav.sectors", href: "/sectors" },
      { labelKey: "nav.recruitment", href: "/recruitment" },
      { labelKey: "nav.salary", href: "/salary" },
      { labelKey: "nav.payslips", href: "/payslips" },
      { labelKey: "nav.deviceManagement", href: "/device-management" },
      { labelKey: "nav.leaveRequests", href: "/leave-requests" },
      { labelKey: "nav.attendance", href: "/attendance" },
      { labelKey: "nav.calendar", href: "/calendar" },
    ],
  },
  admin: {
    id: "admin",
    badgeKey: "modes.admin.badge",
    titleKey: "modes.admin.title",
    titleFallbackKey: "modes.admin.titleFallback",
    subtitleKey: "modes.admin.subtitle",
    emphasisKey: "modes.admin.emphasis",
    showTeamKpis: true,
    showPayrollKpi: true,
    showUnitChart: true,
    actions: [
      { labelKey: "nav.adminConsole", href: "/admin-console", require: "canAccessAdminConsole" },
      { labelKey: "nav.employees", href: "/employees" },
      { labelKey: "nav.sectors", href: "/sectors" },
      { labelKey: "nav.leaveRequests", href: "/leave-requests" },
      { labelKey: "nav.attendance", href: "/attendance" },
      { labelKey: "nav.salary", href: "/salary" },
      { labelKey: "nav.recruitment", href: "/recruitment" },
      { labelKey: "nav.deviceManagement", href: "/device-management" },
      { labelKey: "nav.calendar", href: "/calendar" },
      { labelKey: "nav.myProfile", href: "/profile" },
    ],
  },
  hr: {
    id: "hr",
    badgeKey: "modes.hr.badge",
    titleKey: "modes.hr.title",
    titleFallbackKey: "modes.hr.titleFallback",
    subtitleKey: "modes.hr.subtitle",
    emphasisKey: "modes.hr.emphasis",
    showTeamKpis: true,
    showPayrollKpi: true,
    showUnitChart: true,
    actions: [
      { labelKey: "nav.employees", href: "/employees" },
      { labelKey: "nav.leaveRequests", href: "/leave-requests" },
      { labelKey: "nav.salary", href: "/salary" },
      { labelKey: "nav.salaryAdvances", href: "/salary-advances" },
      { labelKey: "nav.payslips", href: "/payslips" },
      { labelKey: "nav.recruitment", href: "/recruitment" },
      { labelKey: "nav.deviceManagement", href: "/device-management" },
      { labelKey: "nav.attendance", href: "/attendance" },
      { labelKey: "nav.sectors", href: "/sectors" },
      { labelKey: "nav.calendar", href: "/calendar" },
    ],
  },
  sector_lead: {
    id: "sector_lead",
    badgeKey: "modes.sector_lead.badge",
    titleKey: "modes.sector_lead.title",
    titleFallbackKey: "modes.sector_lead.titleFallback",
    subtitleKey: "modes.sector_lead.subtitle",
    emphasisKey: "modes.sector_lead.emphasis",
    showTeamKpis: true,
    showPayrollKpi: true,
    showUnitChart: true,
    actions: [
      { labelKey: "nav.employees", href: "/employees" },
      { labelKey: "nav.leaveRequests", href: "/leave-requests" },
      { labelKey: "nav.salary", href: "/salary" },
      { labelKey: "nav.payslips", href: "/payslips" },
      { labelKey: "nav.recruitment", href: "/recruitment" },
      { labelKey: "nav.deviceManagement", href: "/device-management" },
      { labelKey: "nav.attendance", href: "/attendance" },
      { labelKey: "nav.sectors", href: "/sectors" },
      { labelKey: "nav.calendar", href: "/calendar" },
    ],
  },
  manager: {
    id: "manager",
    badgeKey: "modes.manager.badge",
    titleKey: "modes.manager.title",
    titleFallbackKey: "modes.manager.titleFallback",
    subtitleKey: "modes.manager.subtitle",
    emphasisKey: "modes.manager.emphasis",
    showTeamKpis: true,
    showPayrollKpi: true,
    showUnitChart: true,
    actions: [
      { labelKey: "nav.employees", href: "/employees" },
      { labelKey: "nav.leaveRequests", href: "/leave-requests" },
      { labelKey: "nav.attendance", href: "/attendance" },
      { labelKey: "nav.salary", href: "/salary" },
      { labelKey: "nav.salaryAdvances", href: "/salary-advances" },
      { labelKey: "nav.goals", href: "/goals" },
      { labelKey: "nav.calendar", href: "/calendar" },
      { labelKey: "nav.sectors", href: "/sectors" },
      { labelKey: "nav.myDevices", href: "/my-devices" },
      { labelKey: "nav.myProfile", href: "/profile" },
    ],
  },
  unit_manager: {
    id: "unit_manager",
    badgeKey: "modes.unit_manager.badge",
    titleKey: "modes.unit_manager.title",
    titleFallbackKey: "modes.unit_manager.titleFallback",
    subtitleKey: "modes.unit_manager.subtitle",
    emphasisKey: "modes.unit_manager.emphasis",
    showTeamKpis: true,
    showPayrollKpi: true,
    showUnitChart: true,
    actions: [
      { labelKey: "nav.employees", href: "/employees" },
      { labelKey: "nav.leaveRequests", href: "/leave-requests" },
      { labelKey: "nav.attendance", href: "/attendance" },
      { labelKey: "nav.goals", href: "/goals" },
      { labelKey: "nav.calendar", href: "/calendar" },
      { labelKey: "nav.sectors", href: "/sectors" },
      { labelKey: "nav.mySalary", href: "/salary" },
      { labelKey: "nav.myDevices", href: "/my-devices" },
      { labelKey: "nav.myProfile", href: "/profile" },
    ],
  },
  employee: {
    id: "employee",
    badgeKey: "modes.employee.badge",
    titleKey: "modes.employee.title",
    titleFallbackKey: "modes.employee.titleFallback",
    subtitleKey: "modes.employee.subtitle",
    emphasisKey: "modes.employee.emphasis",
    showTeamKpis: false,
    showPayrollKpi: false,
    showUnitChart: false,
    actions: [
      { labelKey: "nav.attendance", href: "/attendance" },
      { labelKey: "nav.leaveRequests", href: "/leave-requests" },
      { labelKey: "nav.mySalary", href: "/salary" },
      { labelKey: "nav.myAdvances", href: "/salary-advances" },
      { labelKey: "nav.myPayslips", href: "/payslips" },
      { labelKey: "nav.myDevices", href: "/my-devices" },
      { labelKey: "nav.goals", href: "/goals" },
      { labelKey: "nav.myProfile", href: "/profile" },
      { labelKey: "nav.calendar", href: "/calendar" },
    ],
  },
};

/** Exact role → dashboard mode id */
export function getDashboardMode(user) {
  const role = user?.role || "employee";
  if (DASHBOARD_MODES[role]) return role;
  return "employee";
}

export function getDashboardModeConfig(user) {
  return DASHBOARD_MODES[getDashboardMode(user)];
}

/** Filter actions by AuthContext capability flags when `require` is set */
export function getModeActions(modeConfig, authCaps = {}) {
  const actions = modeConfig?.actions || [];
  return actions.filter((a) => {
    if (!a.require) return true;
    return !!authCaps[a.require];
  });
}
