import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  getPortalLoginUrl,
  withEmailDefaults,
} from "./emailTemplate.js";

export default function getPasswordChangeConfirmationMailOptions(email, name) {
  const portalUrl = getPortalLoginUrl();
  const changedAt = new Date().toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const contentHtml = `
    <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
    <p>
      This email confirms that the password for your GammoDA HR System account was changed
      successfully.
    </p>
    ${detailPanel("Security Update", [
      { label: "Account", value: escapeHtml(email) },
      { label: "Updated At", value: escapeHtml(changedAt) },
      { label: "Action", value: "Password changed" },
    ])}
    <p>If you made this change, your account remains secure and no further action is needed.</p>
    <p>If you did not change your password:</p>
    <ol class="steps">
      <li>Try signing in and reset your password immediately.</li>
      <li>Notify HR or system support about the unauthorized change.</li>
      <li>Review your recent account activity.</li>
    </ol>
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(portalUrl)}">Sign In Securely</a>
    </p>
    <div class="notice">
      For your protection, use a strong and unique password that you do not use on other websites.
    </div>
  `;

  return withEmailDefaults({
    to: email,
    subject: "GammoDA HR System - Password Change Confirmation",
    html: buildEmailHtml({
      title: "Password Updated",
      preheader: "Your GammoDA HR password was changed successfully.",
      contentHtml,
      accent: "#1565c0",
    }),
  });
}
