import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  getPortalLoginUrl,
  withEmailDefaults,
} from "./emailTemplate.js";

export default function getPasswordResetMailOptions(email, name, otp) {
  const portalUrl = getPortalLoginUrl();

  const contentHtml = `
    <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
    <p>
      We received a request to reset the password for your GammoDA HR System account.
      Use the one-time password below on the sign-in page.
    </p>
    ${detailPanel("Password Reset Request", [
      { label: "Account Email", value: escapeHtml(email) },
      { label: "Request Type", value: "Password reset" },
      { label: "OTP Validity", value: "10 minutes" },
    ])}
    <p style="text-align:center;"><strong>Your One-Time Password</strong></p>
    <p style="text-align:center;"><span class="otp-box">${escapeHtml(otp)}</span></p>
    <p><strong>How to reset your password</strong></p>
    <ol class="steps">
      <li>Open the sign-in page using the button below.</li>
      <li>Click "Forgot password" and enter your email address.</li>
      <li>Enter the OTP above when prompted, then set your new password.</li>
    </ol>
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(portalUrl)}">Open Password Reset</a>
    </p>
    <div class="notice">
      If you did not request a password reset, ignore this email and contact HR immediately.
      Never share this OTP with anyone.
    </div>
  `;

  return withEmailDefaults({
    to: email,
    subject: "GammoDA HR System - Password Reset OTP",
    html: buildEmailHtml({
      title: "Password Reset OTP",
      preheader: "Use this OTP to reset your GammoDA HR password.",
      contentHtml,
      accent: "#c62828",
    }),
  });
}
