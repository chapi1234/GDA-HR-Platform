import { sendEmail } from "../Email/sendEmail.js";
import getSalaryAdvanceMailOptions from "../Email/salaryAdvanceNotify.js";
import getSalaryAdvanceCancelledMailOptions from "../Email/salaryAdvanceCancelledNotify.js";
import getPayrollCreatedMailOptions from "../Email/payrollCreatedNotify.js";
import getPayrollStatusMailOptions from "../Email/payrollStatusNotify.js";
import { emitToUser } from "../socket.js";
import Notification from "../models/Notification.js";

export async function persistAndEmit({
  recipientId,
  kind,
  title,
  description,
  href = "/salary",
  meta = {},
}) {
  if (!recipientId) return null;

  let row;
  try {
    row = await Notification.create({
      recipient: recipientId,
      kind,
      title,
      description,
      href,
      meta,
    });
  } catch (err) {
    console.error("persist notification", err.message);
  }

  const payload = {
    id: String(row?._id || `${kind}-${Date.now()}`),
    kind,
    title,
    description,
    href,
    createdAt: (row?.createdAt || new Date()).toISOString(),
  };

  emitToUser(recipientId, "notify:personal", payload);
  return row;
}

/**
 * Notify an employee by email + persisted in-app inbox + live socket.
 */
export async function notifySalaryAdvanceRecorded({
  employee,
  advance,
  preparedByName,
}) {
  if (!employee?._id) return;

  const amount = advance?.amount;
  const takenDate = advance?.takenDate;
  const reason = advance?.reason || "";
  const title = "Salary advance recorded";
  const description = `An advance of ${Number(amount || 0).toLocaleString()} ETB was recorded in your name${
    preparedByName ? ` by ${preparedByName}` : ""
  }.`;

  if (employee.email) {
    try {
      await sendEmail(
        getSalaryAdvanceMailOptions({
          email: employee.email,
          name: employee.name,
          amount,
          takenDate,
          reason,
          preparedByName,
          repaymentType: advance?.repaymentType || "full",
          installmentMonths: advance?.installmentMonths,
          monthlyInstallment: advance?.monthlyInstallment,
        })
      );
    } catch (err) {
      console.error("notifySalaryAdvanceRecorded email", err.message);
    }
  }

  await persistAndEmit({
    recipientId: employee._id,
    kind: "salary_advance",
    title,
    description,
    href: "/salary-advances",
    meta: {
      advanceId: String(advance._id || advance.id || ""),
      amount,
    },
  });
}

export async function notifySalaryAdvanceCancelled({
  employee,
  advance,
  cancelledByName,
}) {
  if (!employee?._id || !advance) return;

  const amount = advance.amount;
  const title = "Salary advance cancelled";
  const description = `An advance of ${Number(amount || 0).toLocaleString()} ETB was cancelled${
    cancelledByName ? ` by ${cancelledByName}` : ""
  }.`;

  if (employee.email) {
    try {
      await sendEmail(
        getSalaryAdvanceCancelledMailOptions({
          email: employee.email,
          name: employee.name,
          amount,
          takenDate: advance.takenDate,
          reason: advance.reason,
          cancelledByName,
        })
      );
    } catch (err) {
      console.error("notifySalaryAdvanceCancelled email", err.message);
    }
  }

  await persistAndEmit({
    recipientId: employee._id,
    kind: "salary_advance",
    title,
    description,
    href: "/salary-advances",
    meta: {
      advanceId: String(advance._id || ""),
      amount,
      status: "cancelled",
    },
  });
}

export async function notifyPayrollCreated({
  employee,
  payroll,
  preparedByName,
}) {
  if (!employee?._id) return;

  const title = "Payroll record created";
  const description = `A payroll record (net ${Number(
    payroll.netSalary || 0
  ).toLocaleString()} ETB) was created in your name and is pending approval.`;

  if (employee.email) {
    try {
      await sendEmail(
        getPayrollCreatedMailOptions({
          email: employee.email,
          name: employee.name,
          payDate: payroll.payDate,
          basicSalary: payroll.basicSalary,
          grossSalary: payroll.grossSalary,
          salaryAdvance: payroll.salaryAdvance,
          netSalary: payroll.netSalary,
          status: payroll.status,
          preparedByName,
        })
      );
    } catch (err) {
      console.error("notifyPayrollCreated email", err.message);
    }
  }

  await persistAndEmit({
    recipientId: employee._id,
    kind: "payroll_created",
    title,
    description,
    href: "/salary",
    meta: {
      payrollId: String(payroll._id || payroll.id || ""),
      netSalary: payroll.netSalary,
    },
  });
}

/** status: approved | rejected | paid */
export async function notifyPayrollStatus({
  employee,
  payroll,
  status,
  decidedByName,
  reason = "",
}) {
  if (!employee?._id || !payroll) return;
  const statusKey = String(status || "").toLowerCase();

  const titles = {
    approved: "Payslip available",
    rejected: "Payroll rejected",
    paid: "Salary paid",
  };
  const descriptions = {
    approved: `Your payroll was approved (net ${Number(
      payroll.netSalary || 0
    ).toLocaleString()} ETB). Your payslip is ready.`,
    rejected: `Your payroll was rejected${reason ? `: ${reason}` : "."}`,
    paid: `Your salary (net ${Number(
      payroll.netSalary || 0
    ).toLocaleString()} ETB) has been marked as paid.`,
  };
  const kinds = {
    approved: "payslip_ready",
    rejected: "payroll_rejected",
    paid: "payroll_paid",
  };
  const hrefs = {
    approved: "/payslips",
    rejected: "/salary",
    paid: "/payslips",
  };

  if (employee.email) {
    try {
      await sendEmail(
        getPayrollStatusMailOptions({
          email: employee.email,
          name: employee.name,
          status: statusKey,
          payDate: payroll.payDate,
          payrollMonth: payroll.payrollMonth,
          basicSalary: payroll.basicSalary,
          grossSalary: payroll.grossSalary,
          salaryAdvance: payroll.salaryAdvance,
          netSalary: payroll.netSalary,
          reason,
          decidedByName,
        })
      );
    } catch (err) {
      console.error("notifyPayrollStatus email", err.message);
    }
  }

  await persistAndEmit({
    recipientId: employee._id,
    kind: kinds[statusKey] || "general",
    title: titles[statusKey] || "Payroll update",
    description: descriptions[statusKey] || "Your payroll was updated.",
    href: hrefs[statusKey] || "/salary",
    meta: {
      payrollId: String(payroll._id || ""),
      status: statusKey,
      netSalary: payroll.netSalary,
    },
  });
}
