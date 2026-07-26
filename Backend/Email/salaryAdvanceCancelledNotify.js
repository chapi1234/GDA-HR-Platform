import {
  buildEmailHtml,
  detailPanel,
  escapeHtml,
  getFrontendUrl,
  withEmailDefaults,
} from "./emailTemplate.js";

function formatEtb(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return escapeHtml(String(amount ?? "—"));
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ETB`;
}

/** Email when an open salary advance is cancelled */
export default function getSalaryAdvanceCancelledMailOptions({
  email,
  name,
  amount,
  takenDate,
  reason,
  cancelledByName,
}) {
  const url = `${getFrontendUrl()}/salary-advances`;
  const dateLabel = takenDate ? new Date(takenDate).toLocaleDateString() : "—";

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>
      A salary advance recorded under your name has been <strong>cancelled</strong>
      ${cancelledByName ? ` by ${escapeHtml(cancelledByName)}` : ""}.
      It will not be deducted from payroll.
    </p>
    ${detailPanel("Advance details", [
      { label: "Amount", value: formatEtb(amount) },
      { label: "Date taken", value: escapeHtml(dateLabel) },
      { label: "Reason", value: escapeHtml(reason || "Not specified") },
    ])}
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">View My Advances</a>
    </p>
  `;

  return withEmailDefaults({
    to: email,
    subject: "GammoDA HR — Salary advance cancelled",
    html: buildEmailHtml({
      title: "Salary Advance Cancelled",
      preheader: `An advance of ${formatEtb(amount)} was cancelled`,
      contentHtml,
      accent: "#c62828",
    }),
  });
}
