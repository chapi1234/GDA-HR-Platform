import * as XLSX from "xlsx";

const DEFAULT_BANK = "Commercial Bank of Ethiopia";

/**
 * Bank transfer sheet for one payroll month (approved / paid nets).
 * Bank defaults to CBE; branch / payment reference omitted.
 */
export function exportBankPayrollExcel(rows, monthLabel = "Payroll") {
  const header = [
    "No",
    "Employee ID",
    "Name",
    "Bank",
    "Account Name",
    "Account Number",
    "Net Salary (ETB)",
    "Status",
  ];

  const data = (rows || []).map((r, i) => [
    r.no != null ? r.no : i + 1,
    r.employeeId || "",
    r.name || "",
    r.bankName || DEFAULT_BANK,
    r.accountName || r.name || "",
    r.accountNumber || "",
    Number(r.netSalary || 0),
    r.status || "",
  ]);

  const netTotal = data.reduce((s, row) => s + Number(row[6] || 0), 0);
  const totals = [
    "",
    "",
    "TOTAL",
    "",
    "",
    "",
    netTotal,
    `${data.length} employee(s)`,
  ];

  const sheet = XLSX.utils.aoa_to_sheet([
    ["Gamo Development Association — Bank Salary Transfer"],
    [`Period: ${monthLabel}`],
    [`Currency: ETB · Default bank: ${DEFAULT_BANK}`],
    ["Approved / paid payroll only"],
    [],
    header,
    ...data,
    totals,
  ]);

  sheet["!cols"] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 24 },
    { wch: 28 },
    { wch: 24 },
    { wch: 20 },
    { wch: 16 },
    { wch: 12 },
  ];

  if (!sheet["!pageSetup"]) sheet["!pageSetup"] = {};
  sheet["!pageSetup"].orientation = "landscape";
  sheet["!pageSetup"].fitToPage = true;
  sheet["!pageSetup"].fitToWidth = 1;
  sheet["!pageSetup"].fitToHeight = 0;

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Bank Transfer");
  const safe = String(monthLabel).replace(/[^\w\- ]+/g, "").trim() || "payroll";
  XLSX.writeFile(book, `GaDA-Bank-Transfer-${safe}.xlsx`);
}
