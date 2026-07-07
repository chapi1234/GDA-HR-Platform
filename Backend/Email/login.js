import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  getPortalLoginUrl,
  withEmailDefaults,
} from "./emailTemplate.js";

export default function getLoginMailOptions(email, name) {
  const portalUrl = getPortalLoginUrl();
  const loginTime = new Date().toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const contentHtml = `
    <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
    <p>
      This is a security notification to let you know that your GammoDA HR System account
      was accessed successfully.
    </p>
    ${detailPanel("Login Activity", [
      { label: "Account", value: escapeHtml(email) },
      { label: "Signed in at", value: escapeHtml(loginTime) },
      { label: "Status", value: "Login successful" },
    ])}
    <p>If this login was made by you, no further action is required.</p>
    <p>If you do not recognize this activity:</p>
    <ol class="steps">
      <li>Sign in and change your password from the account settings page.</li>
      <li>Use the "Forgot password" option on the sign-in page if you cannot access your account.</li>
      <li>Contact HR if you suspect unauthorized access.</li>
    </ol>
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(portalUrl)}">Open Sign-In Page</a>
    </p>
    <div class="notice">
      GammoDA will never ask for your password by email. Keep your credentials private.
    </div>
  `;

  return withEmailDefaults({
    to: email,
    subject: "GammoDA HR System - Login Notification",
    html: buildEmailHtml({
      title: "Login Notification",
      preheader: "Your GammoDA HR account was accessed.",
      contentHtml,
      accent: "#1565c0",
    }),
  });
}
