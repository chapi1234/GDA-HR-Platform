import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  getFrontendUrl,
  withEmailDefaults,
} from "./emailTemplate.js";

/** Email when a device is assigned to an employee */
export default function getDeviceAssignedMailOptions({
  email,
  name,
  deviceName,
  serialNumber,
  returnDueDate,
  assignedByName,
}) {
  const devicesUrl = `${getFrontendUrl()}/my-devices`;
  const dueLabel = returnDueDate
    ? new Date(returnDueDate).toLocaleDateString()
    : "Not set";

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>
      A company device has been <strong>assigned</strong> to you
      ${assignedByName ? ` by ${escapeHtml(assignedByName)}` : ""}.
    </p>
    ${detailPanel("Device details", [
      { label: "Device", value: escapeHtml(deviceName || "—") },
      { label: "Serial / ID", value: escapeHtml(serialNumber || "—") },
      { label: "Return due date", value: escapeHtml(dueLabel) },
    ])}
    <p>
      Please take care of this asset. You can view it anytime under <strong>My Devices</strong>.
    </p>
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(devicesUrl)}" target="_blank" rel="noopener noreferrer">View My Devices</a>
    </p>
  `;

  return withEmailDefaults({
    to: email,
    subject: "GammoDA HR — Device assigned to you",
    html: buildEmailHtml({
      title: "Device Assigned",
      preheader: `${deviceName || "A device"} was assigned to you`,
      contentHtml,
      accent: "#2e7d32",
    }),
  });
}
