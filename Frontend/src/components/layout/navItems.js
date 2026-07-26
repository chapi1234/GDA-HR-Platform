import {
  Settings,
  User,
  Users,
  Calendar,
  Building2,
  DollarSign,
  UserCheck,
  Briefcase,
  Laptop,
  MessageSquare,
} from "lucide-react";

const ICONS = {
  Building2,
  User,
  Users,
  Calendar,
  DollarSign,
  UserCheck,
  Briefcase,
  Laptop,
  Settings,
  MessageSquare,
};

/**
 * Build navigation for the current user's capabilities.
 * Labels are i18n keys under `nav.*` — translate with t(item.labelKey) in the layout.
 */
export function getNavigationItems(auth) {
  const {
    canManage,
    canManageHrOps,
    canManagePayroll,
    canViewSalaryAdvances,
    canAccessAdminConsole,
  } = auth;

  const withIcon = (items) =>
    items.map((item) => ({
      ...item,
      icon: ICONS[item.icon] || Building2,
    }));

  if (!canManage) {
    return withIcon([
      { labelKey: "nav.dashboard", href: "/dashboard", icon: "Building2" },
      { labelKey: "nav.chat", href: "/chat", icon: "MessageSquare" },
      { labelKey: "nav.myProfile", href: "/profile", icon: "User" },
      { labelKey: "nav.attendance", href: "/attendance", icon: "UserCheck" },
      { labelKey: "nav.mySalary", href: "/salary", icon: "DollarSign" },
      ...(canViewSalaryAdvances
        ? [{ labelKey: "nav.myAdvances", href: "/salary-advances", icon: "DollarSign" }]
        : []),
      { labelKey: "nav.myPayslips", href: "/payslips", icon: "DollarSign" },
      { labelKey: "nav.leaveRequests", href: "/leave-requests", icon: "Calendar" },
      { labelKey: "nav.calendar", href: "/calendar", icon: "Calendar" },
      { labelKey: "nav.myDevices", href: "/my-devices", icon: "Laptop" },
      { labelKey: "nav.goals", href: "/goals", icon: "Briefcase" },
      { labelKey: "nav.settings", href: "/settings", icon: "Settings" },
    ]);
  }

  return withIcon([
    { labelKey: "nav.dashboard", href: "/dashboard", icon: "Building2" },
    { labelKey: "nav.chat", href: "/chat", icon: "MessageSquare" },
    ...(canAccessAdminConsole
      ? [{ labelKey: "nav.adminConsole", href: "/admin-console", icon: "Settings" }]
      : []),
    { labelKey: "nav.myProfile", href: "/profile", icon: "User" },
    { labelKey: "nav.employees", href: "/employees", icon: "Users" },
    { labelKey: "nav.sectors", href: "/sectors", icon: "Building2" },
    { labelKey: "nav.attendance", href: "/attendance", icon: "UserCheck" },
    {
      labelKey: canManagePayroll ? "nav.salary" : "nav.mySalary",
      href: "/salary",
      icon: "DollarSign",
    },
    ...(canViewSalaryAdvances
      ? [
          {
            labelKey: canManagePayroll ? "nav.salaryAdvances" : "nav.myAdvances",
            href: "/salary-advances",
            icon: "DollarSign",
          },
        ]
      : []),
    ...(canManagePayroll
      ? [{ labelKey: "nav.payslips", href: "/payslips", icon: "DollarSign" }]
      : [{ labelKey: "nav.myPayslips", href: "/payslips", icon: "DollarSign" }]),
    { labelKey: "nav.leaveRequests", href: "/leave-requests", icon: "Calendar" },
    ...(canManageHrOps
      ? [
          { labelKey: "nav.recruitment", href: "/recruitment", icon: "Briefcase" },
          { labelKey: "nav.deviceManagement", href: "/device-management", icon: "Laptop" },
        ]
      : [{ labelKey: "nav.myDevices", href: "/my-devices", icon: "Laptop" }]),
    { labelKey: "nav.calendar", href: "/calendar", icon: "Calendar" },
    { labelKey: "nav.goals", href: "/goals", icon: "Briefcase" },
    { labelKey: "nav.settings", href: "/settings", icon: "Settings" },
  ]);
}
