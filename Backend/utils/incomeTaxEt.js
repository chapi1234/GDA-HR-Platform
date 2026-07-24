/**
 * Ethiopia employment income tax (PAYE) — monthly progressive brackets.
 * Taxable base = Gross − employee pension (common employment practice).
 *
 * 0 — 2,000        0%
 * 2,001 — 4,000   15% − 300
 * 4,001 — 7,000   20% − 500
 * 7,001 — 10,000  25% − 850
 * 10,001 — 14,000 30% − 1,350
 * Over 14,000     35% − 2,050
 */
export function computeEthiopiaPaye(taxableIncome) {
  const g = Number(taxableIncome);
  if (!Number.isFinite(g) || g <= 0) return 0;
  if (g <= 2000) return 0;
  let tax;
  if (g <= 4000) tax = g * 0.15 - 300;
  else if (g <= 7000) tax = g * 0.2 - 500;
  else if (g <= 10000) tax = g * 0.25 - 850;
  else if (g <= 14000) tax = g * 0.3 - 1350;
  else tax = g * 0.35 - 2050;
  return Math.round(Math.max(0, tax) * 100) / 100;
}
