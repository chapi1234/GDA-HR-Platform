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
      { label: "Dashboard", href: "/dashboard", icon: "Building2" },
      { label: "Chat", href: "/chat", icon: "MessageSquare" },
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
    ]);
  }

  return withIcon([
    { label: "Dashboard", href: "/dashboard", icon: "Building2" },
    { label: "Chat", href: "/chat", icon: "MessageSquare" },
    ...(canAccessAdminConsole
      ? [{ label: "Admin Console", href: "/admin-console", icon: "Settings" }]
      : []),
    { label: "My Profile", href: "/profile", icon: "User" },
    { label: "Employees", href: "/employees", icon: "Users" },
    { label: "Sectors", href: "/sectors", icon: "Building2" },
    { label: "Attendance", href: "/attendance", icon: "UserCheck" },
    {
      label: canManagePayroll ? "Salary" : "My Salary",
      href: "/salary",
      icon: "DollarSign",
    },
    ...(canViewSalaryAdvances
      ? [
          {
            label: canManagePayroll ? "Salary Advances" : "My Advances",
            href: "/salary-advances",
            icon: "DollarSign",
          },
        ]
      : []),
    ...(canManagePayroll
      ? [{ label: "Payslips", href: "/payslips", icon: "DollarSign" }]
      : [{ label: "My Payslips", href: "/payslips", icon: "DollarSign" }]),
    { label: "Leave Requests", href: "/leave-requests", icon: "Calendar" },
    ...(canManageHrOps
      ? [
          { label: "Recruitment", href: "/recruitment", icon: "Briefcase" },
          { label: "Device Management", href: "/device-management", icon: "Laptop" },
        ]
      : [{ label: "My Devices", href: "/my-devices", icon: "Laptop" }]),
    { label: "Calendar", href: "/calendar", icon: "Calendar" },
    { label: "Goals", href: "/goals", icon: "Briefcase" },
    { label: "Settings", href: "/settings", icon: "Settings" },
  ]);
}
