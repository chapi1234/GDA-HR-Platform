import Payslip from "../models/Payslip.js";
import { monthLabelFromKey, payrollMonthKey } from "./payrollMonth.js";

/** Build GaDA-style earnings/deductions for a payslip */
export function breakdownFromPayroll(payroll) {
  return [
    { label: "Basic Salary", amount: Number(payroll.basicSalary || 0), type: "earning" },
    { label: "House allowance", amount: Number(payroll.houseAllowance || 0), type: "earning" },
    { label: "Telephone", amount: Number(payroll.telephone || 0), type: "earning" },
    {
      label: "Transport allowance",
      amount: Number(payroll.transportAllowance || 0),
      type: "earning",
    },
    {
      label: "Pension (employee 11%)",
      amount: Number(payroll.pensionEmployee || 0),
      type: "deduction",
    },
    { label: "Income tax (PAYE)", amount: Number(payroll.incomeTax || 0), type: "deduction" },
    { label: "Membership fee", amount: Number(payroll.membershipFee || 0), type: "deduction" },
    { label: "Salary advance", amount: Number(payroll.salaryAdvance || 0), type: "deduction" },
    { label: "Other", amount: Number(payroll.other || 0), type: "deduction" },
  ].filter((row) => row.amount !== 0 || ["Basic Salary"].includes(row.label));
}

/**
 * Create or refresh a payslip when payroll is approved.
 * Returns the payslip document.
 */
export async function upsertPayslipFromPayroll(payroll) {
  if (!payroll?.employee || !payroll?.payDate) {
    throw new Error("Payroll missing employee or payDate");
  }

  const monthKey = payroll.payrollMonth || payrollMonthKey(payroll.payDate);
  const monthLabel = monthLabelFromKey(monthKey);
  const start = payroll.payPeriod?.startDate
    ? new Date(payroll.payPeriod.startDate)
    : null;
  const end = payroll.payPeriod?.endDate
    ? new Date(payroll.payPeriod.endDate)
    : null;
  const period =
    start && end
      ? `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`
      : monthLabel;

  const payload = {
    employee: payroll.employee,
    payroll: payroll._id,
    month: monthLabel,
    payrollMonth: monthKey,
    period,
    grossSalary: Number(payroll.grossSalary || 0),
    netSalary: Number(payroll.netSalary || 0),
    deductions: Number(payroll.totalDeduction ?? payroll.deductions ?? 0),
    status: "unpaid",
    payDate: payroll.payDate,
    salaryBreakdown: breakdownFromPayroll(payroll),
    employeeName: payroll.employeeName || "",
    employeeId: payroll.employeeId || "",
    department: payroll.department || "",
  };

  let payslip = await Payslip.findOne({ payroll: payroll._id });
  if (!payslip) {
    payslip = await Payslip.findOne({
      employee: payroll.employee,
      payrollMonth: monthKey,
    });
  }

  if (payslip) {
    Object.assign(payslip, payload);
    await payslip.save();
  } else {
    payslip = await Payslip.create(payload);
  }

  return payslip;
}
