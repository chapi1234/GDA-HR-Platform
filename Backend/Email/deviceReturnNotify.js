import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  getFrontendUrl,
  withEmailDefaults,
} from "./emailTemplate.js";

export default function getDeviceReturnDueMailOptions({
  email,
  name,
  deviceName,
  serialNumber,
  dueDate,
  overdue,
}) {
  const devicesUrl = `${getFrontendUrl()}/my-devices`;
  const dueLabel = dueDate ? new Date(dueDate).toLocaleDateString() : "—";

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>
      ${
        overdue
          ? "The return date for a company device assigned to you has <strong>passed</strong>. Please return it as soon as possible."
          : "A company device assigned to you is <strong>due for return today</strong>."
      }
    </p>
    ${detailPanel("Device details", [
      { label: "Device", value: escapeHtml(deviceName || "—") },
      { label: "Serial / ID", value: escapeHtml(serialNumber || "—") },
      { label: "Return due date", value: escapeHtml(dueLabel) },
    ])}
    <p>
      Please hand the device back to HR or your sector lead. If you believe you
      need it longer, contact HR to extend the due date.
    </p>
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(devicesUrl)}">View My Devices</a>
    </p>
  `;

  return withEmailDefaults({
    to: email,
    subject: overdue
      ? "GammoDA HR — Device return overdue"
      : "GammoDA HR — Device return due today",
    html: buildEmailHtml({
      title: overdue ? "Device Return Overdue" : "Device Return Due",
      preheader: `Please return ${deviceName || "your assigned device"}`,
      contentHtml,
    }),
  });
}
