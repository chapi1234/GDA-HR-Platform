import * as XLSX from "xlsx";

/**
 * Export visible GaDA payroll rows for one month to .xlsx
 */
export function exportGadaPayrollSheet(rows, monthLabel = "Payroll") {
  const header = [
    "No",
    "Employee ID",
    "Name",
    "Pay Date",
    "Basic Salary",
    "House",
    "Telephone",
    "Transport",
    "Pension GaDA 11%",
    "Pension 11%",
    "Gross Salary",
    "Income Tax",
    "Membership",
    "Salary Advance",
    "Other",
    "Total Deduction",
    "Net",
    "Status",
  ];

  const data = (rows || []).map((r, i) => [
    i + 1,
    r.employeeId || "",
    r.employeeName || "",
    r.payDate || "",
    Number(r.basicSalary || 0),
    Number(r.houseAllowance || 0),
    Number(r.telephone || 0),
    Number(r.transportAllowance || 0),
    Number(r.pensionGada || 0),
    Number(r.pensionEmployee || 0),
    Number(r.grossSalary || 0),
    Number(r.incomeTax || 0),
    Number(r.membershipFee || 0),
    Number(r.salaryAdvance || 0),
    Number(r.other || 0),
    Number(r.totalDeduction || 0),
    Number(r.netSalary || 0),
    r.status || "",
  ]);

  const totals = [
    "",
    "",
    "TOTAL",
    "",
    ...[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((col) =>
      data.reduce((s, row) => s + Number(row[col] || 0), 0)
    ),
    "",
  ];

  const sheet = XLSX.utils.aoa_to_sheet([
    ["Gamo Development Association — Salary Payment Payroll Sheet"],
    [`Period: ${monthLabel}`],
    [],
    header,
    ...data,
    totals,
  ]);

  sheet["!cols"] = header.map((_, i) => ({
    wch: i === 2 ? 22 : i === 0 ? 5 : 14,
  }));

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Payroll");
  const safe = String(monthLabel).replace(/[^\w\- ]+/g, "").trim() || "payroll";
  XLSX.writeFile(book, `GaDA-Payroll-${safe}.xlsx`);
}
