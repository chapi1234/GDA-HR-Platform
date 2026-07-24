/**
 * Dashboard mode config — one mode per exact role (see modification.md §6.1).
 */

export const DASHBOARD_MODES = {
  superadmin: {
    id: "superadmin",
    badge: "Super Admin Mode",
    title: (name) => `Welcome back, ${name || "Super Admin"}!`,
    subtitle: "Full system control — manage everything across GammoDA.",
    emphasis: "Add Admins & Org HR, manage sectors, people, payroll, and all modules.",
    showTeamKpis: true,
    showPayrollKpi: true,
    showUnitChart: true,
    actions: [
      { label: "Admin Console", href: "/admin-console" },
      { label: "Employees", href: "/employees" },
      { label: "Sectors", href: "/sectors" },
      { label: "Recruitment", href: "/recruitment" },
      { label: "Salary", href: "/salary" },
      { label: "Payslips", href: "/payslips" },
      { label: "Devices", href: "/device-management" },
      { label: "Leave", href: "/leave-requests" },
      { label: "Attendance", href: "/attendance" },
      { label: "Calendar", href: "/calendar" },
    ],
  },
  admin: {
    id: "admin",
    badge: "Org Admin Mode",
    title: (name) => `Welcome back, ${name || "Org Admin"}!`,
    subtitle: "Organization-wide administration across GammoDA.",
    emphasis: "Manage accounts, appoint Sector Leads, and oversee all sectors.",
    showTeamKpis: true,
    showPayrollKpi: true,
    showUnitChart: true,
    actions: [
      { label: "Admin Console", href: "/admin-console", require: "canAccessAdminConsole" },
      { label: "Employees", href: "/employees" },
      { label: "Sectors", href: "/sectors" },
      { label: "Leave", href: "/leave-requests" },
      { label: "Attendance", href: "/attendance" },
      { label: "Salary", href: "/salary" },
      { label: "Recruitment", href: "/recruitment" },
      { label: "Devices", href: "/device-management" },
      { label: "Calendar", href: "/calendar" },
      { label: "Profile", href: "/profile" },
    ],
  },
  hr: {
    id: "hr",
    badge: "Org HR Mode",
    title: (name) => `Welcome back, ${name || "Org HR"}!`,
    subtitle: "Central people operations across all sectors.",
    emphasis: "Employees, leave, payroll, recruitment, and devices — organization-wide.",
    showTeamKpis: true,
    showPayrollKpi: true,
    showUnitChart: true,
    actions: [
      { label: "Employees", href: "/employees" },
      { label: "Leave", href: "/leave-requests" },
      { label: "Salary", href: "/salary" },
      { label: "Advances", href: "/salary-advances" },
      { label: "Payslips", href: "/payslips" },
      { label: "Recruitment", href: "/recruitment" },
      { label: "Devices", href: "/device-management" },
      { label: "Attendance", href: "/attendance" },
      { label: "Sectors", href: "/sectors" },
      { label: "Calendar", href: "/calendar" },
    ],
  },
  sector_lead: {
    id: "sector_lead",
    badge: "Sector Lead Mode",
    title: (name) => `Welcome back, ${name || "Sector Lead"}!`,
    subtitle: "Lead your sector — people ops and unit oversight in one role.",
    emphasis: "Manage employees, leave, payroll, hiring, and devices for your sector only.",
    showTeamKpis: true,
    showPayrollKpi: true,
    showUnitChart: true,
    actions: [
      { label: "Employees", href: "/employees" },
      { label: "Leave", href: "/leave-requests" },
      { label: "Salary", href: "/salary" },
      { label: "Payslips", href: "/payslips" },
      { label: "Recruitment", href: "/recruitment" },
      { label: "Devices", href: "/device-management" },
      { label: "Attendance", href: "/attendance" },
      { label: "Sectors", href: "/sectors" },
      { label: "Calendar", href: "/calendar" },
    ],
  },
  manager: {
    id: "manager",
    badge: "Manager Mode",
    title: (name) => `Welcome back, ${name || "Manager"}!`,
    subtitle: "Lead your sub-sector — team roster, leave, and attendance.",
    emphasis: "Review leave, track attendance, prepare payroll, and appoint Unit Managers. No org-wide admin tools.",
    showTeamKpis: true,
    showPayrollKpi: true,
    showUnitChart: true,
    actions: [
      { label: "Employees", href: "/employees" },
      { label: "Leave", href: "/leave-requests" },
      { label: "Attendance", href: "/attendance" },
      { label: "Salary", href: "/salary" },
      { label: "Advances", href: "/salary-advances" },
      { label: "Goals", href: "/goals" },
      { label: "Calendar", href: "/calendar" },
      { label: "Sectors", href: "/sectors" },
      { label: "My Devices", href: "/my-devices" },
      { label: "Profile", href: "/profile" },
    ],
  },
  unit_manager: {
    id: "unit_manager",
    badge: "Unit Manager Mode",
    title: (name) => `Welcome back, ${name || "Unit Manager"}!`,
    subtitle: "Lead your nested unit — team roster, leave, and attendance.",
    emphasis: "Review leave and support staff in your sub-sub-sector only.",
    showTeamKpis: true,
    showPayrollKpi: true,
    showUnitChart: true,
    actions: [
      { label: "Employees", href: "/employees" },
      { label: "Leave", href: "/leave-requests" },
      { label: "Attendance", href: "/attendance" },
      { label: "Goals", href: "/goals" },
      { label: "Calendar", href: "/calendar" },
      { label: "Sectors", href: "/sectors" },
      { label: "My Salary", href: "/salary" },
      { label: "My Devices", href: "/my-devices" },
      { label: "Profile", href: "/profile" },
    ],
  },
  employee: {
    id: "employee",
    badge: "Employee Mode",
    title: (name) => `Welcome back, ${name || "there"}!`,
    subtitle: "Your self-service workspace.",
    emphasis: "Attendance, leave, salary, devices, and goals — your records only.",
    showTeamKpis: false,
    showPayrollKpi: false,
    showUnitChart: false,
    actions: [
      { label: "Attendance", href: "/attendance" },
      { label: "Leave", href: "/leave-requests" },
      { label: "My Salary", href: "/salary" },
      { label: "My Advances", href: "/salary-advances" },
      { label: "My Payslips", href: "/payslips" },
      { label: "My Devices", href: "/my-devices" },
      { label: "Goals", href: "/goals" },
      { label: "Profile", href: "/profile" },
      { label: "Calendar", href: "/calendar" },
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
