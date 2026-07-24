import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  getPortalLoginUrl,
  withEmailDefaults,
} from "./emailTemplate.js";

export default function getRegisterMailOptions(email, name) {
  const portalUrl = getPortalLoginUrl();

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>
      Your registration with the Gammo Development Association HR platform is complete.
      You can now sign in and start using the system.
    </p>
    ${detailPanel("Registration Summary", [
      { label: "Registered Name", value: escapeHtml(name) },
      { label: "Registered Email", value: escapeHtml(email) },
      { label: "Account Status", value: "Active" },
    ])}
    <p><strong>What you can do next</strong></p>
    <ul class="steps">
      <li>Sign in to your dashboard using your registered credentials.</li>
      <li>Complete your profile information if prompted.</li>
      <li>Explore attendance, leave, payroll, and sector tools available to your role.</li>
    </ul>
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(portalUrl)}">Go to Sign-In Page</a>
    </p>
    <p>
      If you did not create this account, please contact HR immediately so we can secure
      your information.
    </p>
  `;

  return withEmailDefaults({
    to: email,
    subject: "GammoDA HR System - Registration Successful",
    html: buildEmailHtml({
      title: "Registration Successful",
      preheader: "Your GammoDA HR account is ready to use.",
      contentHtml,
      accent: "#2e7d32",
    }),
  });
}
