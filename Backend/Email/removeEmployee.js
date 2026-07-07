import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  withEmailDefaults,
} from "./emailTemplate.js";

export default function getRemoveEmployeeMailOptions(
  email,
  name,
  position,
  department
) {
  const effectiveDate = new Date().toLocaleDateString("en-US", {
    dateStyle: "full",
  });

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>
      This message confirms that your access to the Gammo Development Association HR System
      has been deactivated as part of an account removal or offboarding process.
    </p>
    ${detailPanel("Account Removal Details", [
      { label: "Employee Name", value: escapeHtml(name) },
      { label: "Work Email", value: escapeHtml(email) },
      { label: "Last Position", value: escapeHtml(position || "Not specified") },
      { label: "Department", value: escapeHtml(department || "Not specified") },
      { label: "Effective Date", value: escapeHtml(effectiveDate) },
      { label: "Portal Access", value: "Disabled" },
    ])}
    <p>
      You will no longer be able to sign in to the employee portal, submit leave requests,
      or access payroll records through this system.
    </p>
    <p>
      If you believe this action was taken in error, or if you need assistance with final
      HR documentation, please contact the HR department as soon as possible.
    </p>
    <div class="notice">
      Thank you for your service with Gammo Development Association. We wish you success
      in your future endeavors.
    </div>
  `;

  return withEmailDefaults({
    to: email,
    subject: "GammoDA HR System - Account Removal Notification",
    html: buildEmailHtml({
      title: "Account Removal Notice",
      preheader: "Your GammoDA HR system access has been deactivated.",
      contentHtml,
      accent: "#c62828",
    }),
  });
}
