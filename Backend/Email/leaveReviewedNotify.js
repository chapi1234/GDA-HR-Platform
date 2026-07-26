import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  getFrontendUrl,
  withEmailDefaults,
} from "./emailTemplate.js";

/** Email to employee when leave is approved or rejected */
export default function getLeaveReviewedMailOptions({
  email,
  name,
  leaveType,
  startDate,
  endDate,
  days,
  status,
  comments,
  reviewedByName,
}) {
  const leaveUrl = `${getFrontendUrl()}/leave-requests`;
  const approved = String(status).toLowerCase() === "approved";
  const startLabel = startDate ? new Date(startDate).toLocaleDateString() : "—";
  const endLabel = endDate ? new Date(endDate).toLocaleDateString() : "—";

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>
      Your <strong>${escapeHtml(leaveType || "leave")}</strong> request has been
      <strong>${approved ? "approved" : "rejected"}</strong>
      ${reviewedByName ? ` by ${escapeHtml(reviewedByName)}` : ""}.
    </p>
    ${detailPanel("Leave details", [
      { label: "Type", value: escapeHtml(leaveType || "—") },
      { label: "From", value: escapeHtml(startLabel) },
      { label: "To", value: escapeHtml(endLabel) },
      { label: "Days", value: escapeHtml(String(days ?? "—")) },
      { label: "Decision", value: approved ? "Approved" : "Rejected" },
      {
        label: "Comments",
        value: escapeHtml(comments || "None"),
      },
    ])}
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(leaveUrl)}" target="_blank" rel="noopener noreferrer">View Leave Requests</a>
    </p>
  `;

  return withEmailDefaults({
    to: email,
    subject: approved
      ? "GammoDA HR — Your leave request was approved"
      : "GammoDA HR — Your leave request was rejected",
    html: buildEmailHtml({
      title: approved ? "Leave Approved" : "Leave Rejected",
      preheader: `Your ${leaveType || "leave"} request was ${approved ? "approved" : "rejected"}`,
      contentHtml,
      accent: approved ? "#2e7d32" : "#c62828",
    }),
  });
}
