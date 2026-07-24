import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  getFrontendUrl,
  withEmailDefaults,
} from "./emailTemplate.js";

function formatEtb(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return escapeHtml(String(amount ?? "—"));
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ETB`;
}

export default function getPayrollCreatedMailOptions({
  email,
  name,
  payDate,
  basicSalary,
  grossSalary,
  salaryAdvance,
  netSalary,
  status,
  preparedByName,
}) {
  const salaryUrl = `${getFrontendUrl()}/salary`;
  const dateLabel = payDate ? new Date(payDate).toLocaleDateString() : "—";

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>
      A <strong>payroll / salary record</strong> has been created under your name in the GammoDA HR System
      and is currently <strong>${escapeHtml(status || "pending")}</strong>.
    </p>
    ${detailPanel("Payroll summary", [
      { label: "Pay date", value: escapeHtml(dateLabel) },
      { label: "Basic salary", value: formatEtb(basicSalary) },
      { label: "Gross salary", value: formatEtb(grossSalary) },
      { label: "Salary advance", value: formatEtb(salaryAdvance) },
      { label: "Net salary", value: formatEtb(netSalary) },
      {
        label: "Prepared by",
        value: escapeHtml(preparedByName || "Manager / HR"),
      },
    ])}
    <p>
      You can review this on <strong>My Salary</strong> in the portal. If anything looks incorrect,
      contact your Manager or Org HR.
    </p>
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(salaryUrl)}">View My Salary</a>
    </p>
  `;

  return withEmailDefaults({
    to: email,
    subject: "GammoDA HR — Payroll record created in your name",
    html: buildEmailHtml({
      title: "Payroll Record Created",
      preheader: `A payroll row for ${dateLabel} was created for you`,
      contentHtml,
    }),
  });
}
