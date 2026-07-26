import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  formatCurrency,
  getFrontendUrl,
  withEmailDefaults,
} from "./emailTemplate.js";

/**
 * Payroll status email: approved | rejected | paid
 */
export default function getPayrollStatusMailOptions({
  email,
  name,
  status,
  payDate,
  payrollMonth,
  basicSalary,
  grossSalary,
  salaryAdvance,
  netSalary,
  reason,
  decidedByName,
}) {
  const statusKey = String(status || "").toLowerCase();
  const salaryUrl = `${getFrontendUrl()}/salary`;
  const payslipsUrl = `${getFrontendUrl()}/payslips`;
  const dateLabel = payDate
    ? new Date(payDate).toLocaleDateString()
    : payrollMonth || "—";

  const titles = {
    approved: "Payroll Approved — Payslip Ready",
    rejected: "Payroll Rejected",
    paid: "Salary Paid",
  };
  const subjects = {
    approved: "GammoDA HR — Your payroll was approved",
    rejected: "GammoDA HR — Your payroll was rejected",
    paid: "GammoDA HR — Your salary has been paid",
  };
  const intros = {
    approved: `Your payroll record has been <strong>approved</strong>${
      decidedByName ? ` by ${escapeHtml(decidedByName)}` : ""
    }. Your payslip is now available in the portal.`,
    rejected: `Your payroll record has been <strong>rejected</strong>${
      decidedByName ? ` by ${escapeHtml(decidedByName)}` : ""
    }. Please contact HR if you have questions.`,
    paid: `Your salary for this period has been marked as <strong>paid</strong>${
      decidedByName ? ` by ${escapeHtml(decidedByName)}` : ""
    }.`,
  };
  const accents = {
    approved: "#2e7d32",
    rejected: "#c62828",
    paid: "#1565c0",
  };
  const buttonHref = statusKey === "approved" || statusKey === "paid" ? payslipsUrl : salaryUrl;
  const buttonLabel =
    statusKey === "approved" || statusKey === "paid"
      ? "View Payslips"
      : "View My Salary";

  const rows = [
    { label: "Pay date / month", value: escapeHtml(String(dateLabel)) },
    { label: "Basic salary", value: formatCurrency(basicSalary) },
    { label: "Gross salary", value: formatCurrency(grossSalary) },
    { label: "Salary advance", value: formatCurrency(salaryAdvance) },
    { label: "Net salary", value: formatCurrency(netSalary) },
    { label: "Status", value: escapeHtml(statusKey || "—") },
  ];
  if (statusKey === "rejected" && reason) {
    rows.push({ label: "Reason", value: escapeHtml(reason) });
  }

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>${intros[statusKey] || intros.approved}</p>
    ${detailPanel("Payroll summary", rows)}
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(buttonHref)}" target="_blank" rel="noopener noreferrer">${buttonLabel}</a>
    </p>
  `;

  return withEmailDefaults({
    to: email,
    subject: subjects[statusKey] || subjects.approved,
    html: buildEmailHtml({
      title: titles[statusKey] || titles.approved,
      preheader: `Payroll ${statusKey} — net ${formatCurrency(netSalary)}`,
      contentHtml,
      accent: accents[statusKey] || accents.approved,
    }),
  });
}
