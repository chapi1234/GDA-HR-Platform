import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  getFrontendUrl,
  withEmailDefaults,
} from "./emailTemplate.js";
import { monthLabelFromKey } from "../utils/payrollMonth.js";

/** Email managers when month-end payroll rows are still missing */
export default function getPayrollReminderMailOptions({
  email,
  name,
  payrollMonth,
  missingCount,
}) {
  const salaryUrl = `${getFrontendUrl()}/salary`;
  const monthLabel = monthLabelFromKey(payrollMonth) || payrollMonth || "—";

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(name || "Manager")}</strong>,</p>
    <p>
      This is a reminder that payroll preparation for
      <strong>${escapeHtml(monthLabel)}</strong> is incomplete in your sub-sector.
    </p>
    ${detailPanel("Reminder", [
      { label: "Payroll month", value: escapeHtml(monthLabel) },
      {
        label: "Employees still missing a payroll row",
        value: escapeHtml(String(missingCount ?? 0)),
      },
    ])}
    <p>Please create the remaining payroll records so Org HR can review and approve them on time.</p>
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(salaryUrl)}" target="_blank" rel="noopener noreferrer">Open Payroll</a>
    </p>
  `;

  return withEmailDefaults({
    to: email,
    subject: `GammoDA HR — Payroll reminder for ${monthLabel}`,
    html: buildEmailHtml({
      title: "Payroll Month-End Reminder",
      preheader: `${missingCount} employee(s) still need a ${monthLabel} payroll row`,
      contentHtml,
      accent: "#ed6c02",
    }),
  });
}
