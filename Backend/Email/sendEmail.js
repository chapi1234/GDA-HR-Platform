import transporter from "./nodemailer.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(email) {
  return EMAIL_PATTERN.test(String(email || "").trim());
}

/**
 * Sends an email and returns whether Gmail SMTP accepted the message.
 * SMTP success does not guarantee inbox delivery (spam, invalid addresses, etc.).
 */
export async function sendEmail(mailOptions) {
  const to = mailOptions?.to;

  if (!to || !isValidEmailAddress(to)) {
    const error = "Invalid recipient email address";
    console.error(`Email not sent: ${error} (${to || "missing"})`);
    return { sent: false, error, acceptedByServer: false };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `Email accepted by Gmail for ${to}. messageId=${info.messageId} response=${info.response}`
    );
    console.log(
      "Note: SMTP OK means Gmail queued the message. Check spam folder; fake/invalid addresses may never arrive."
    );
    return {
      sent: true,
      acceptedByServer: true,
      messageId: info.messageId,
      response: info.response,
      to,
    };
  } catch (err) {
    console.error(`Email failed for ${to}:`, err.message);
    return {
      sent: false,
      acceptedByServer: false,
      error: err.message,
      to,
    };
  }
}
