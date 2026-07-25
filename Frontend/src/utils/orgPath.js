/**
 * unitPath looks like "Sector › Sub-sector › Unit".
 * Returns only the last (most specific) segment for compact display.
 */
export function unitLeaf(unitPath) {
  return String(unitPath || "")
    .split("›")
    .map((s) => s.trim())
    .filter(Boolean)
    .pop() || "";
}
