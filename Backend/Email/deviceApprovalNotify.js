import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  getFrontendUrl,
  withEmailDefaults,
} from "./emailTemplate.js";

/** Email to HR/Admin when sector lead requests device assignment */
export function getDeviceApprovalRequestMailOptions({
  email,
  approverName,
  requesterName,
  employeeName,
  deviceName,
  serialNumber,
}) {
  const url = `${getFrontendUrl()}/device-management`;

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(approverName || "HR")}</strong>,</p>
    <p>
      <strong>${escapeHtml(requesterName || "A sector lead")}</strong> requested to assign a
      device. Please approve or reject this request.
    </p>
    ${detailPanel("Assignment request", [
      { label: "Device", value: escapeHtml(deviceName || "—") },
      { label: "Serial / ID", value: escapeHtml(serialNumber || "—") },
      { label: "Assign to", value: escapeHtml(employeeName || "—") },
      { label: "Requested by", value: escapeHtml(requesterName || "—") },
    ])}
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Review Device Assignments</a>
    </p>
  `;

  return withEmailDefaults({
    to: email,
    subject: "GammoDA HR — Device assignment awaiting approval",
    html: buildEmailHtml({
      title: "Assignment Pending Approval",
      preheader: `${requesterName || "Sector lead"} requested a device assignment`,
      contentHtml,
      accent: "#f57c00",
    }),
  });
}

/** Email to requester when HR approves/rejects their assignment request */
export function getDeviceApprovalDecisionMailOptions({
  email,
  name,
  approved,
  deviceName,
  employeeName,
  decidedByName,
}) {
  const url = `${getFrontendUrl()}/device-management`;
  const ok = !!approved;

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>
      Your request to assign <strong>${escapeHtml(deviceName || "a device")}</strong>
      to <strong>${escapeHtml(employeeName || "the employee")}</strong> was
      <strong>${ok ? "approved" : "rejected"}</strong>
      ${decidedByName ? ` by ${escapeHtml(decidedByName)}` : ""}.
    </p>
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open Device Management</a>
    </p>
  `;

  return withEmailDefaults({
    to: email,
    subject: ok
      ? "GammoDA HR — Device assignment approved"
      : "GammoDA HR — Device assignment rejected",
    html: buildEmailHtml({
      title: ok ? "Assignment Approved" : "Assignment Rejected",
      preheader: `Your device assignment request was ${ok ? "approved" : "rejected"}`,
      contentHtml,
      accent: ok ? "#2e7d32" : "#c62828",
    }),
  });
}
