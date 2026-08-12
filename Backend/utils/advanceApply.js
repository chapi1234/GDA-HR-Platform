import SalaryAdvance from "../models/SalaryAdvance.js";

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
}

/**
 * Apply open advances (full remaining or partial via advanceAmounts map).
 * advanceAmounts: { [advanceId]: number } optional installment amounts.
 */
export async function applyAdvancesToPayroll({
  employeeId,
  advanceIds = [],
  advanceAmounts = {},
  payrollId,
}) {
  const ids = Array.isArray(advanceIds)
    ? advanceIds.map(String).filter((id) => /^[0-9a-fA-F]{24}$/.test(id))
    : [];

  if (!ids.length) {
    return { advanceIds: [], salaryAdvanceTotal: 0 };
  }

  const rows = await SalaryAdvance.find({
    _id: { $in: ids },
    employee: employeeId,
    status: "open",
  });

  if (rows.length !== ids.length) {
    return {
      error:
        "One or more selected advances are missing, not open, or not for this employee",
    };
  }

  let salaryAdvanceTotal = 0;
  for (const row of rows) {
    const remaining =
      row.remainingAmount != null ? n(row.remainingAmount) : n(row.amount);
    const requested =
      advanceAmounts[String(row._id)] != null
        ? n(advanceAmounts[String(row._id)])
        : remaining;
    const applyAmt = Math.min(remaining, Math.max(0, requested));
    if (applyAmt <= 0) {
      return { error: `Invalid apply amount for advance ${row._id}` };
    }
    salaryAdvanceTotal = n(salaryAdvanceTotal + applyAmt);
    row.status = "applied";
    row.payroll = payrollId;
    row.appliedAt = new Date();
    row.appliedAmount = applyAmt;
    row.remainingAmount = n(remaining - applyAmt);
    await row.save();
  }

  return { advanceIds: ids, salaryAdvanceTotal };
}

export async function reopenAdvancesForPayroll(payrollId) {
  if (!payrollId) return;
  const rows = await SalaryAdvance.find({
    payroll: payrollId,
    status: "applied",
  });
  for (const row of rows) {
    const applied = n(row.appliedAmount || 0);
    const rem = n(row.remainingAmount || 0);
    row.remainingAmount = n(rem + applied);
    row.status = "open";
    row.payroll = null;
    row.appliedAt = null;
    row.appliedAmount = 0;
    await row.save();
  }
}

/**
 * On approve: fully recovered if remaining is 0, else reopen for next month.
 */
export async function recoverAdvancesForPayroll(payrollId) {
  if (!payrollId) return;
  const rows = await SalaryAdvance.find({
    payroll: payrollId,
    status: "applied",
  });
  for (const row of rows) {
    const rem = n(row.remainingAmount || 0);
    if (rem <= 0) {
      row.status = "recovered";
      row.recoveredAt = new Date();
      row.appliedAmount = 0;
      await row.save();
    } else {
      row.status = "open";
      row.payroll = null;
      row.appliedAt = null;
      row.appliedAmount = 0;
      await row.save();
    }
  }
}
