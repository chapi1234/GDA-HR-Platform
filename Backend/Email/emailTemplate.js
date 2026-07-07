import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const LOGO_CID = "gammoda-logo";
const LOGO_PATH = path.join(__dirname, "assets", "logo.jpg");

export const COMPANY_NAME = "Gammo Development Association";
export const SYSTEM_NAME = "GammoDA HR System";

export function getSupportEmail() {
  return process.env.EMAIL || "hr@gammoda.com";
}

export function getFrontendUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:8080").replace(/\/$/, "");
}

export function getPortalLoginUrl() {
  return `${getFrontendUrl()}/auth`;
}

export function getFromAddress() {
  const email = process.env.EMAIL;
  if (!email) return undefined;
  return `"${SYSTEM_NAME}" <${email}>`;
}

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCurrency(amount) {
  if (amount === undefined || amount === null || amount === "") {
    return "Not specified";
  }
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) {
    return escapeHtml(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function getLogoAttachment() {
  return {
    filename: "logo.jpg",
    path: LOGO_PATH,
    cid: LOGO_CID,
  };
}

export function withEmailDefaults(mailOptions) {
  return {
    from: getFromAddress() || process.env.EMAIL,
    ...mailOptions,
    attachments: [...(mailOptions.attachments || []), getLogoAttachment()],
  };
}

export function buildEmailHtml({
  title,
  preheader = "",
  contentHtml,
  accent = "#2e7d32",
}) {
  const safeTitle = escapeHtml(title);
  const year = new Date().getFullYear();
  const supportEmail = getSupportEmail();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f7f5; font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; }
    .preheader { display: none; max-height: 0; overflow: hidden; opacity: 0; }
    .wrapper { width: 100%; padding: 32px 16px; box-sizing: border-box; }
    .card { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
    .header { background: linear-gradient(135deg, ${accent} 0%, #1565c0 100%); padding: 28px 32px; text-align: center; color: #ffffff; }
    .logo { width: 88px; height: 88px; object-fit: contain; background: #ffffff; border-radius: 16px; padding: 8px; margin-bottom: 16px; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.2px; }
    .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.92; }
    .body { padding: 32px; line-height: 1.7; font-size: 15px; }
    .body p { margin: 0 0 16px; }
    .panel { background: #f8fafc; border: 1px solid #e5e7eb; border-left: 4px solid ${accent}; border-radius: 10px; padding: 18px 20px; margin: 20px 0; }
    .panel-title { margin: 0 0 12px; font-size: 16px; font-weight: 700; color: #111827; }
    .detail-row { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-row:last-child { border-bottom: none; padding-bottom: 0; }
    .detail-label { font-weight: 600; color: #4b5563; min-width: 130px; }
    .detail-value { color: #111827; text-align: right; word-break: break-word; }
    .otp-box { display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1565c0; background: #e8f1ff; border-radius: 10px; padding: 14px 22px; margin: 8px 0 16px; }
    .steps { margin: 0; padding-left: 20px; }
    .steps li { margin-bottom: 10px; }
    .notice { background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; border-radius: 10px; padding: 14px 16px; margin: 20px 0; font-size: 14px; }
    .button { display: inline-block; background: ${accent}; color: #ffffff !important; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 600; margin-top: 8px; }
    .footer { background: #f8fafc; padding: 22px 32px; text-align: center; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; line-height: 1.6; }
    .footer strong { color: #374151; }
    @media (max-width: 600px) {
      .body, .header, .footer { padding-left: 20px; padding-right: 20px; }
      .detail-row { flex-direction: column; gap: 4px; }
      .detail-value { text-align: left; }
    }
  </style>
</head>
<body>
  <div class="preheader">${escapeHtml(preheader)}</div>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <img src="cid:${LOGO_CID}" alt="${escapeHtml(COMPANY_NAME)} logo" class="logo" />
        <h1>${safeTitle}</h1>
        <p>${escapeHtml(SYSTEM_NAME)}</p>
      </div>
      <div class="body">
        ${contentHtml}
      </div>
      <div class="footer">
        <strong>${escapeHtml(COMPANY_NAME)}</strong><br />
        Human Resource Management System<br />
        Need help? Contact us at <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a><br />
        &copy; ${year} ${escapeHtml(COMPANY_NAME)}. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function detailPanel(title, rows) {
  const rowsHtml = rows
    .map(
      ({ label, value }) => `
        <div class="detail-row">
          <span class="detail-label">${escapeHtml(label)}</span>
          <span class="detail-value">${value}</span>
        </div>`
    )
    .join("");

  return `
    <div class="panel">
      <p class="panel-title">${escapeHtml(title)}</p>
      ${rowsHtml}
    </div>`;
}
