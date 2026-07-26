import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  getFrontendUrl,
  withEmailDefaults,
} from "./emailTemplate.js";

/** Email to managers / HR when an employee submits leave */
export default function getLeaveSubmittedMailOptions({
  email,
  approverName,
  employeeName,
  leaveType,
  startDate,
  endDate,
  days,
  reason,
}) {
  const leaveUrl = `${getFrontendUrl()}/leave-requests`;
  const startLabel = startDate ? new Date(startDate).toLocaleDateString() : "—";
  const endLabel = endDate ? new Date(endDate).toLocaleDateString() : "—";

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(approverName || "Manager")}</strong>,</p>
    <p>
      <strong>${escapeHtml(employeeName || "An employee")}</strong> submitted a
      <strong>leave request</strong> that needs your review.
    </p>
    ${detailPanel("Leave request", [
      { label: "Employee", value: escapeHtml(employeeName || "—") },
      { label: "Type", value: escapeHtml(leaveType || "—") },
      { label: "From", value: escapeHtml(startLabel) },
      { label: "To", value: escapeHtml(endLabel) },
      { label: "Days", value: escapeHtml(String(days ?? "—")) },
      { label: "Reason", value: escapeHtml(reason || "—") },
    ])}
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(leaveUrl)}" target="_blank" rel="noopener noreferrer">Review Leave Requests</a>
    </p>
  `;

  return withEmailDefaults({
    to: email,
    subject: `GammoDA HR — Leave request from ${employeeName || "employee"}`,
    html: buildEmailHtml({
      title: "New Leave Request",
      preheader: `${employeeName || "Employee"} requested ${leaveType || "leave"}`,
      contentHtml,
      accent: "#1565c0",
    }),
  });
}
