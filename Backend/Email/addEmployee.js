import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  formatCurrency,
  getPortalLoginUrl,
  withEmailDefaults,
} from "./emailTemplate.js";

export default function getAddEmployeeMailOptions(
  email,
  name,
  position,
  department,
  salary,
  password
) {
  const portalUrl = getPortalLoginUrl();
  const safePosition = escapeHtml(position || "Not specified");
  const safeDepartment = escapeHtml(department || "Not specified");

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>
      Welcome to the Gammo Development Association family. Your employee account has been
      created in our HR system, and you now have access to attendance, leave requests,
      payroll information, and other employee services.
    </p>
    ${detailPanel("Your Account Details", [
      { label: "Full Name", value: escapeHtml(name) },
      { label: "Work Email", value: escapeHtml(email) },
      { label: "Position", value: safePosition },
      { label: "Department", value: safeDepartment },
      { label: "Salary", value: formatCurrency(salary) },
      {
        label: "Temporary Password",
        value: `<strong style="color:#c62828;">${escapeHtml(password)}</strong>`,
      },
    ])}
    <p><strong>Getting started</strong></p>
    <ol class="steps">
      <li>Visit the employee portal and sign in with your work email and temporary password.</li>
      <li>Change your password immediately after your first login.</li>
      <li>Review your profile details and confirm your department assignment.</li>
      <li>Contact HR if any information above is incorrect.</li>
    </ol>
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(portalUrl)}">Open Employee Portal</a>
    </p>
    <div class="notice">
      For security, do not share your login credentials with anyone. If you did not expect
      this email, please contact HR right away.
    </div>
  `;

  return withEmailDefaults({
    to: email,
    subject: "Welcome to GammoDA HR System - Your Account Details",
    html: buildEmailHtml({
      title: "Welcome Aboard",
      preheader: `Your GammoDA HR account is ready. Position: ${position || "Employee"}`,
      contentHtml,
      accent: "#2e7d32",
    }),
  });
}
