/** GaDA payroll sheet calculations */

import { computeEthiopiaPaye } from "./incomeTaxEt.js";

function n(value) {
  const x = Number(value);
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
}

/**
 * Compute payroll amounts from sheet inputs.
 * Income tax = PAYE on (Gross − employee pension) when blank.
 */
export function computePayrollSheet(input = {}) {
  const basicSalary = n(input.basicSalary);
  const houseAllowance = n(input.houseAllowance);
  const telephone = n(input.telephone);
  const transportAllowance = n(input.transportAllowance);

  const pensionGada =
    input.pensionGada !== undefined && input.pensionGada !== ""
      ? n(input.pensionGada)
      : n(basicSalary * 0.11);
  const pensionEmployee =
    input.pensionEmployee !== undefined && input.pensionEmployee !== ""
      ? n(input.pensionEmployee)
      : n(basicSalary * 0.11);

  const grossSalary = n(
    basicSalary + houseAllowance + telephone + transportAllowance
  );

  const taxable = Math.max(0, grossSalary - pensionEmployee);
  const incomeTax =
    input.incomeTax !== undefined && input.incomeTax !== ""
      ? n(input.incomeTax)
      : computeEthiopiaPaye(taxable);
  const membershipFee = n(input.membershipFee);
  const salaryAdvance = n(input.salaryAdvance);
  const other = n(input.other);

  const totalDeduction = n(
    pensionEmployee + incomeTax + membershipFee + salaryAdvance + other
  );
  const netSalary = n(grossSalary - totalDeduction);

  return {
    basicSalary,
    houseAllowance,
    telephone,
    transportAllowance,
    pensionGada,
    pensionEmployee,
    grossSalary,
    incomeTax,
    membershipFee,
    salaryAdvance,
    other,
    totalDeduction,
    netSalary,
    taxableIncome: taxable,
    bonus: 0,
    deductions: totalDeduction,
  };
}

export function serializePayroll(doc, index = null) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  obj.id = obj._id;
  if (index != null) obj.no = index + 1;

  if (obj.grossSalary == null && obj.basicSalary != null) {
    const computed = computePayrollSheet({
      basicSalary: obj.basicSalary,
      houseAllowance: obj.houseAllowance,
      telephone: obj.telephone,
      transportAllowance: obj.transportAllowance,
      pensionGada: obj.pensionGada,
      pensionEmployee: obj.pensionEmployee,
      incomeTax: obj.incomeTax,
      membershipFee: obj.membershipFee,
      salaryAdvance: obj.salaryAdvance,
      other: obj.other ?? obj.bonus,
    });
    Object.assign(obj, {
      ...computed,
      totalDeduction: obj.totalDeduction ?? obj.deductions ?? computed.totalDeduction,
      netSalary: obj.netSalary ?? computed.netSalary,
    });
  }

  return obj;
}
