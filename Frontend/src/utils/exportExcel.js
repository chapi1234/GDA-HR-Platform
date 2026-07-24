import * as XLSX from "xlsx";

/**
 * Build a simple titled worksheet and download as .xlsx
 * @param {{ title?: string, subtitle?: string, headers: string[], rows: any[][], sheetName?: string, filename: string, colWidths?: number[] }} opts
 */
export function exportTableExcel({
  title,
  subtitle,
  headers,
  rows,
  sheetName = "Sheet1",
  filename,
  colWidths,
}) {
  const aoa = [];
  if (title) aoa.push([title]);
  if (subtitle) aoa.push([subtitle]);
  if (title || subtitle) aoa.push([]);
  aoa.push(headers);
  aoa.push(...(rows || []));

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = (colWidths || headers.map((h, i) => ({
    wch: Math.min(28, Math.max(10, String(h).length + 2, i === 0 ? 5 : 14)),
  }))).map((w) => (typeof w === "number" ? { wch: w } : w));

  if (!sheet["!pageSetup"]) sheet["!pageSetup"] = {};
  sheet["!pageSetup"].orientation = "landscape";
  sheet["!pageSetup"].fitToPage = true;
  sheet["!pageSetup"].fitToWidth = 1;

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  const safe = String(filename || "export").replace(/[^\w.\- ]+/g, "").trim() || "export";
  XLSX.writeFile(book, safe.endsWith(".xlsx") ? safe : `${safe}.xlsx`);
}
