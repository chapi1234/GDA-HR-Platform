/**
 * Ethiopia PAYE — taxable base normally Gross − employee pension.
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
