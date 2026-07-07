import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  withEmailDefaults,
} from "./emailTemplate.js";

function sanitizeSubject(subject) {
  return String(subject || "New message from website")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 120);
}

export default function getContactMailOptions({ name, email, subject, message }) {
  const safeMessage = escapeHtml(message || "").replace(/\n/g, "<br />");
  const safeSubject = sanitizeSubject(subject);

  const contentHtml = `
    <p>A new message was submitted through the GammoDA website contact form.</p>
    ${detailPanel("Sender Information", [
      { label: "Name", value: escapeHtml(name || "(Not provided)") },
      { label: "Email", value: escapeHtml(email || "(Not provided)") },
      { label: "Subject", value: escapeHtml(subject || "(No subject)") },
    ])}
    <div class="panel">
      <p class="panel-title">Message</p>
      <p style="margin:0;">${safeMessage || "(Empty message)"}</p>
    </div>
    <p>Reply directly to the sender using the email address listed above.</p>
  `;

  return withEmailDefaults({
    to: process.env.EMAIL,
    subject: `[Contact Form] ${safeSubject}`,
    replyTo: email,
    html: buildEmailHtml({
      title: "New Contact Message",
      preheader: `New contact form message from ${name || "website visitor"}`,
      contentHtml,
      accent: "#1565c0",
    }),
  });
}
