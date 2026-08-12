/**
 * Payroll calendar-month helpers (YYYY-MM).
 * Date-only strings like "2026-08-01" are treated as calendar dates (not
 * timezone-shifted), so August 1 never becomes July.
 */

/** Parse YYYY-MM-DD (or Date) into a Date at UTC noon — stable calendar day. */
export function parsePayDateInput(input) {
  if (input == null || input === "") return null;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return new Date(
      Date.UTC(
        input.getUTCFullYear(),
        input.getUTCMonth(),
        input.getUTCDate(),
        12,
        0,
        0
      )
    );
  }
  const raw = String(input).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0)
  );
}

/** YYYY-MM for a pay date (string or Date). Prefer digits from the input. */
export function payrollMonthKey(payDate) {
  if (!payDate) return null;
  if (typeof payDate === "string") {
    const match = payDate.trim().match(/^(\d{4})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}`;
  }
  const d = parsePayDateInput(payDate);
  if (!d) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Inclusive UTC range for a YYYY-MM key (for Mongo payDate queries). */
export function monthRangeFromKey(monthKey) {
  const [y, m] = String(monthKey || "").split("-").map(Number);
  if (!y || !m) return null;
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end };
}

export function monthLabelFromKey(monthKey) {
  const [y, m] = String(monthKey || "").split("-").map(Number);
  if (!y || !m) return monthKey || "";
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
