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

export default function getSalaryAdvanceMailOptions({
  email,
  name,
  amount,
  takenDate,
  reason,
  preparedByName,
}) {
  const advancesUrl = `${getFrontendUrl()}/salary-advances`;
  const dateLabel = takenDate
    ? new Date(takenDate).toLocaleDateString()
    : "—";

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(name)}</strong>,</p>
    <p>
      A <strong>salary advance</strong> has been recorded under your name in the GammoDA HR System.
      This amount is expected to be deducted from a future payroll unless cancelled.
    </p>
    ${detailPanel("Advance details", [
      { label: "Amount", value: formatEtb(amount) },
      { label: "Date taken", value: escapeHtml(dateLabel) },
      { label: "Reason", value: escapeHtml(reason || "Not specified") },
      {
        label: "Recorded by",
        value: escapeHtml(preparedByName || "Manager / HR"),
      },
    ])}
    <p>
      If you did not request this advance or the details look wrong, contact your Manager or Org HR immediately.
    </p>
    <p style="text-align:center;">
      <a class="button" href="${escapeHtml(advancesUrl)}">View My Advances</a>
    </p>
  `;

  return withEmailDefaults({
    to: email,
    subject: "GammoDA HR — Salary advance recorded in your name",
    html: buildEmailHtml({
      title: "Salary Advance Recorded",
      preheader: `An advance of ${formatEtb(amount)} was recorded for you`,
      contentHtml,
    }),
  });
}
