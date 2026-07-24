import Leave from "../models/Leave.js";
import PayrollMonthLock from "../models/PayrollMonthLock.js";

export function pushAudit(payroll, action, user, note = "") {
  if (!payroll.auditLog) payroll.auditLog = [];
  payroll.auditLog.push({
    action,
    by: user?._id || user?.id || null,
    byName: user?.name || "",
    at: new Date(),
    note: note || "",
  });
}

export async function isMonthLocked(payrollMonth) {
  if (!payrollMonth) return false;
  const row = await PayrollMonthLock.findOne({ payrollMonth }).lean();
  return !!row;
}

/** Locked months block all mutations until unlocked (including Super Admin). */
export async function assertMonthWritable(payrollMonth) {
  if (!(await isMonthLocked(payrollMonth))) return null;
  return `Payroll month ${payrollMonth} is locked. Unlock the month before making changes.`;
}

/** Unpaid leave days overlapping [start, end] → daily rate deduction suggestion */
export async function unpaidLeaveDeduction(employeeId, basicSalary, start, end) {
  const leaves = await Leave.find({
    employee: employeeId,
    status: "approved",
    type: "unpaid",
    startDate: { $lte: end },
    endDate: { $gte: start },
  }).lean();

  let days = 0;
  for (const leave of leaves) {
    const from = new Date(Math.max(new Date(leave.startDate), start));
    const to = new Date(Math.min(new Date(leave.endDate), end));
    const ms = to - from;
    if (ms < 0) continue;
    const d = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
    days += leave.days != null ? Math.min(Number(leave.days), d) : d;
  }
  const daily = Number(basicSalary || 0) / 30;
  const amount = Math.round(days * daily * 100) / 100;
  return { days, amount };
}
