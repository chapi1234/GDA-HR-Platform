import Payroll from "../models/Payroll.js";
import Employee from "../models/Employee.js";
import { canAccessEmployee, getScopedEmployeeIds } from "../utils/scope.js";
import { isOrgWide, ROLES } from "../utils/roles.js";
import {
  computePayrollSheet,
  serializePayroll,
} from "../utils/payrollSheet.js";
import {
  applyAdvancesToPayroll,
  reopenAdvancesForPayroll,
  recoverAdvancesForPayroll,
} from "../utils/advanceApply.js";
import {
  notifyPayrollCreated,
  notifyPayrollStatus,
} from "../utils/notifyEmployee.js";
import { payrollMonthKey, monthLabelFromKey, monthRangeFromKey } from "../utils/payrollMonth.js";
import { upsertPayslipFromPayroll } from "../utils/payslipFromPayroll.js";
import {
  pushAudit,
  assertMonthWritable,
  unpaidLeaveDeduction,
} from "../utils/payrollOps.js";
import { logActivity } from "../utils/logActivity.js";

function actorId(user) {
  return user?._id || user?.id;
}

/** Who may create payroll rows */
export function canCreatePayroll(user) {
  if (!user) return false;
  if (user.role === ROLES.HR && isOrgWide(user)) return true;
  if (user.role === ROLES.MANAGER) return true;
  return false;
}

/** Who may edit/delete pending payrolls in scope */
export function canMutatePayroll(user, payroll = null) {
  if (!user) return false;
  if (user.role === ROLES.MANAGER) return true;
  // Org HR may only adjust pending rows they themselves prepared
  if (
    user.role === ROLES.HR &&
    isOrgWide(user) &&
    payroll?.preparedBy &&
    String(payroll.preparedBy) === String(actorId(user))
  ) {
    return true;
  }
  return false;
}

export function canApprovePayroll(user) {
  return user?.role === ROLES.HR && isOrgWide(user);
}

/** List visibility: team leads & org roles see scoped lists; staff see own */
function canViewTeamPayroll(user) {
  return [
    ROLES.MANAGER,
    ROLES.UNIT_MANAGER,
    ROLES.SECTOR_LEAD,
    ROLES.HR,
    ROLES.ADMIN,
    ROLES.SUPERADMIN,
  ].includes(user?.role);
}

function sheetPayloadFromBody(body = {}) {
  return computePayrollSheet({
    basicSalary: body.basicSalary ?? body.baseSalary,
    houseAllowance: body.houseAllowance,
    telephone: body.telephone,
    transportAllowance: body.transportAllowance,
    pensionGada: body.pensionGada,
    pensionEmployee: body.pensionEmployee,
    incomeTax: body.incomeTax,
    membershipFee: body.membershipFee,
    salaryAdvance: body.salaryAdvance,
    other: body.other,
  });
}

/** Reject if another non-rejected payroll exists for same employee + calendar month */
async function assertNoDuplicateMonth(employeeId, payDate, excludeId = null) {
  const month = payrollMonthKey(payDate);
  if (!month) {
    return { error: "Invalid pay date" };
  }
  const range = monthRangeFromKey(month);
  const query = {
    employee: employeeId,
    status: { $in: ["pending", "approved", "paid"] },
    $or: [
      { payrollMonth: month },
      {
        $or: [{ payrollMonth: null }, { payrollMonth: { $exists: false } }],
        payDate: { $gte: range.start, $lte: range.end },
      },
    ],
  };
  if (excludeId) query._id = { $ne: excludeId };
  const existing = await Payroll.findOne(query).select("status payDate employeeName");
  if (existing) {
    return {
      error: `A ${existing.status} payroll already exists for this employee in ${monthLabelFromKey(
        month
      )}. Reject or delete it first, or pick another month.`,
    };
  }
  return { month };
}

export const createPayroll = async (req, res) => {
  try {
    if (!canCreatePayroll(req.user)) {
      return res.status(403).json({
        status: false,
        message: "Only Sub-sector Managers or Org HR can create payroll records",
      });
    }

    const {
      employee,
      employeeId,
      payDate,
      periodStart,
      periodEnd,
      notes,
    } = req.body;

    if ((!employee && !employeeId) || !(req.body.basicSalary ?? req.body.baseSalary) || !payDate) {
      return res.status(400).json({
        status: false,
        message: "Required: employee, basicSalary, payDate",
      });
    }

    let empDoc = null;
    const objIdRegex = typeof employee === "string" && /^[0-9a-fA-F]{24}$/.test(employee);
    if (employee && objIdRegex) {
      empDoc = await Employee.findById(employee).populate("department", "name");
    } else if (employeeId) {
      empDoc = await Employee.findOne({ employeeId }).populate("department", "name");
    }

    if (!empDoc) {
      return res.status(404).json({ status: false, message: "Employee not found" });
    }

    if (!canAccessEmployee(req.user, empDoc)) {
      return res.status(403).json({
        status: false,
        message: "You can only create payroll for staff in your organizational unit",
      });
    }

    // Managers are limited to their sub-sector
    if (req.user.role === ROLES.MANAGER) {
      if (
        !req.user.subSectorId ||
        String(empDoc.subSectorId || "") !== String(req.user.subSectorId)
      ) {
        return res.status(403).json({
          status: false,
          message: "Managers can only create payroll for their sub-sector",
        });
      }
    }

    const amounts = sheetPayloadFromBody(req.body);
    const pay = new Date(payDate);
    const start = periodStart ? new Date(periodStart) : new Date(pay.getFullYear(), pay.getMonth(), 1);
    const end = periodEnd
      ? new Date(periodEnd)
      : new Date(pay.getFullYear(), pay.getMonth() + 1, 0);

    const dup = await assertNoDuplicateMonth(empDoc._id, pay);
    if (dup.error) {
      return res.status(409).json({ status: false, message: dup.error });
    }

    const lockErr = await assertMonthWritable(dup.month);
    if (lockErr) {
      return res.status(403).json({ status: false, message: lockErr });
    }

    // Auto unpaid-leave into Other when client did not set other
    let otherValue = req.body.other;
    if (otherValue === undefined || otherValue === "") {
      const leaveAdj = await unpaidLeaveDeduction(
        empDoc._id,
        amounts.basicSalary,
        start,
        end
      );
      if (leaveAdj.amount > 0) {
        otherValue = leaveAdj.amount;
        amounts.other = leaveAdj.amount;
        Object.assign(
          amounts,
          computePayrollSheet({
            ...req.body,
            basicSalary: amounts.basicSalary,
            other: leaveAdj.amount,
            incomeTax: req.body.incomeTax,
          })
        );
      }
    }

    const payroll = new Payroll({
      employee: empDoc._id,
      employeeId: empDoc.employeeId,
      employeeName: empDoc.name,
      department: empDoc.department?.name || empDoc.unitPath || "",
      position: empDoc.position,
      sectorId: empDoc.sectorId || null,
      subSectorId: empDoc.subSectorId || null,
      subSubSectorId: empDoc.subSubSectorId || null,
      payDate: pay,
      payPeriod: { startDate: start, endDate: end },
      payrollMonth: dup.month,
      ...amounts,
      advanceIds: [],
      status: "pending",
      preparedBy: actorId(req.user),
      notes: notes || "",
      auditLog: [],
    });
    pushAudit(payroll, "created", req.user, notes || "");

    await payroll.save();

    const advanceResult = await applyAdvancesToPayroll({
      employeeId: empDoc._id,
      advanceIds: req.body.advanceIds || [],
      advanceAmounts: req.body.advanceAmounts || {},
      payrollId: payroll._id,
    });
    if (advanceResult.error) {
      await Payroll.findByIdAndDelete(payroll._id);
      return res.status(400).json({ status: false, message: advanceResult.error });
    }

    if (advanceResult.advanceIds.length) {
      const withAdvances = computePayrollSheet({
        ...amounts,
        salaryAdvance: advanceResult.salaryAdvanceTotal,
      });
      Object.assign(payroll, withAdvances);
      payroll.advanceIds = advanceResult.advanceIds;
      await payroll.save();
    }

    const populated = await Payroll.findById(payroll._id)
      .populate({ path: "employee", select: "name employeeId department position" })
      .populate({ path: "preparedBy", select: "name role" })
      .populate({ path: "advanceIds" });

    // Fire-and-forget employee notification (email + in-app)
    notifyPayrollCreated({
      employee: empDoc,
      payroll: populated || payroll,
      preparedByName: req.user?.name || populated?.preparedBy?.name,
    }).catch((err) => console.error("payroll notify", err));

    logActivity({
      actor: empDoc._id,
      action: "Payroll record created",
      type: "payroll",
      meta: {
        payrollId: String(payroll._id),
        payrollMonth: payroll.payrollMonth || "",
        netSalary: payroll.netSalary,
        preparedBy: String(actorId(req.user) || ""),
        preparedByName: req.user?.name || "",
      },
    });

    return res.status(201).json({
      status: true,
      message: "Payroll record created (pending Org HR approval)",
      data: serializePayroll(populated),
    });
  } catch (err) {
    console.error("createPayroll", err);
    if (err?.code === 11000) {
      return res.status(409).json({
        status: false,
        message:
          "A payroll already exists for this employee in that month. Reject or delete it first.",
      });
    }
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const getPayrolls = async (req, res) => {
  try {
    const user = req.user;
    let query = {};

    if (canViewTeamPayroll(user)) {
      const scopedIds = await getScopedEmployeeIds(user);
      if (scopedIds !== null) {
        query = { employee: { $in: scopedIds } };
      }
    } else {
      query = { employee: actorId(user) };
    }

    const payrolls = await Payroll.find(query)
      .populate({ path: "employee", select: "name employeeId sectorId subSectorId" })
      .populate({ path: "preparedBy", select: "name role" })
      .populate({ path: "approvedBy", select: "name role" })
      .populate({ path: "advanceIds" })
      .sort({ payDate: -1, createdAt: -1 });

    return res.json({
      status: true,
      data: payrolls.map((p, i) => serializePayroll(p, i)),
    });
  } catch (err) {
    console.error("getPayrolls", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const updatePayroll = async (req, res) => {
  try {
    const { id } = req.params;
    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return res.status(404).json({ status: false, message: "Payroll not found" });
    }

    if (!canMutatePayroll(req.user, payroll)) {
      return res.status(403).json({
        status: false,
        message:
          "Only Sub-sector Managers can update payroll (Org HR may edit their own pending drafts)",
      });
    }

    if (payroll.status !== "pending") {
      return res.status(400).json({
        status: false,
        message: "Only pending payroll records can be updated",
      });
    }

    const lockErr = await assertMonthWritable(
      payroll.payrollMonth || payrollMonthKey(payroll.payDate)
    );
    if (lockErr) {
      return res.status(403).json({ status: false, message: lockErr });
    }

    const emp = await Employee.findById(payroll.employee);
    if (!emp || !canAccessEmployee(req.user, emp)) {
      return res.status(403).json({ status: false, message: "Outside your organizational scope" });
    }

    if (req.user.role === ROLES.MANAGER) {
      if (
        !req.user.subSectorId ||
        String(payroll.subSectorId || emp.subSectorId || "") !==
          String(req.user.subSectorId)
      ) {
        return res.status(403).json({
          status: false,
          message: "Managers can only update payroll in their sub-sector",
        });
      }
    }

    // Re-link advances when client sends advanceIds
    let salaryAdvanceValue =
      req.body.salaryAdvance ?? payroll.salaryAdvance;
    if (Array.isArray(req.body.advanceIds)) {
      await reopenAdvancesForPayroll(payroll._id);
      const advanceResult = await applyAdvancesToPayroll({
        employeeId: payroll.employee,
        advanceIds: req.body.advanceIds,
        advanceAmounts: req.body.advanceAmounts || {},
        payrollId: payroll._id,
      });
      if (advanceResult.error) {
        return res.status(400).json({ status: false, message: advanceResult.error });
      }
      payroll.advanceIds = advanceResult.advanceIds;
      salaryAdvanceValue = advanceResult.advanceIds.length
        ? advanceResult.salaryAdvanceTotal
        : req.body.salaryAdvance != null
          ? req.body.salaryAdvance
          : 0;
    }

    const amounts = sheetPayloadFromBody({
      basicSalary: req.body.basicSalary ?? req.body.baseSalary ?? payroll.basicSalary,
      houseAllowance: req.body.houseAllowance ?? payroll.houseAllowance,
      telephone: req.body.telephone ?? payroll.telephone,
      transportAllowance: req.body.transportAllowance ?? payroll.transportAllowance,
      pensionGada: req.body.pensionGada ?? payroll.pensionGada,
      pensionEmployee: req.body.pensionEmployee ?? payroll.pensionEmployee,
      incomeTax: req.body.incomeTax ?? payroll.incomeTax,
      membershipFee: req.body.membershipFee ?? payroll.membershipFee,
      salaryAdvance: salaryAdvanceValue,
      other: req.body.other ?? payroll.other,
    });

    Object.assign(payroll, amounts);
    if (req.body.payDate) {
      const nextPay = new Date(req.body.payDate);
      const dup = await assertNoDuplicateMonth(payroll.employee, nextPay, payroll._id);
      if (dup.error) {
        return res.status(409).json({ status: false, message: dup.error });
      }
      const nextLockErr = await assertMonthWritable(dup.month);
      if (nextLockErr) {
        return res.status(403).json({ status: false, message: nextLockErr });
      }
      payroll.payDate = nextPay;
      payroll.payrollMonth = dup.month;
    } else if (!payroll.payrollMonth) {
      payroll.payrollMonth = payrollMonthKey(payroll.payDate);
    }
    if (req.body.notes !== undefined) payroll.notes = req.body.notes;
    if (req.body.periodStart || req.body.periodEnd) {
      payroll.payPeriod = {
        startDate: req.body.periodStart
          ? new Date(req.body.periodStart)
          : payroll.payPeriod.startDate,
        endDate: req.body.periodEnd
          ? new Date(req.body.periodEnd)
          : payroll.payPeriod.endDate,
      };
    }

    await payroll.save();
    pushAudit(payroll, "updated", req.user, "");
    await payroll.save();
    const populated = await Payroll.findById(payroll._id)
      .populate({ path: "employee", select: "name employeeId" })
      .populate({ path: "preparedBy", select: "name role" })
      .populate({ path: "advanceIds" });

    return res.json({
      status: true,
      message: "Payroll updated",
      data: serializePayroll(populated),
    });
  } catch (err) {
    console.error("updatePayroll", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const deletePayroll = async (req, res) => {
  try {
    const { id } = req.params;
    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return res.status(404).json({ status: false, message: "Payroll not found" });
    }

    if (!canMutatePayroll(req.user, payroll)) {
      return res.status(403).json({
        status: false,
        message:
          "Only Sub-sector Managers can delete payroll (Org HR may delete their own pending drafts)",
      });
    }

    if (payroll.status !== "pending") {
      return res.status(400).json({
        status: false,
        message: "Only pending payroll records can be deleted",
      });
    }

    const lockErrDel = await assertMonthWritable(
      payroll.payrollMonth || payrollMonthKey(payroll.payDate)
    );
    if (lockErrDel) {
      return res.status(403).json({ status: false, message: lockErrDel });
    }

    const emp = await Employee.findById(payroll.employee);
    if (!emp || !canAccessEmployee(req.user, emp)) {
      return res.status(403).json({ status: false, message: "Outside your organizational scope" });
    }

    if (req.user.role === ROLES.MANAGER) {
      if (
        !req.user.subSectorId ||
        String(payroll.subSectorId || emp.subSectorId || "") !==
          String(req.user.subSectorId)
      ) {
        return res.status(403).json({
          status: false,
          message: "Managers can only delete payroll in their sub-sector",
        });
      }
    }

    await reopenAdvancesForPayroll(payroll._id);
    await Payroll.findByIdAndDelete(id);
    return res.json({ status: true, message: "Payroll deleted" });
  } catch (err) {
    console.error("deletePayroll", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const approvePayroll = async (req, res) => {
  try {
    if (!canApprovePayroll(req.user)) {
      return res.status(403).json({
        status: false,
        message: "Only Org HR can approve payroll records",
      });
    }

    const { id } = req.params;
    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return res.status(404).json({ status: false, message: "Payroll not found" });
    }
    if (payroll.status !== "pending") {
      return res.status(400).json({
        status: false,
        message: "Only pending payroll can be approved",
      });
    }

    const monthKey = payroll.payrollMonth || payrollMonthKey(payroll.payDate);
    const lockErr = await assertMonthWritable(monthKey);
    if (lockErr) {
      return res.status(403).json({ status: false, message: lockErr });
    }

    payroll.status = "approved";
    payroll.approvedBy = actorId(req.user);
    payroll.approvedAt = new Date();
    payroll.rejectionReason = "";
    if (!payroll.payrollMonth) {
      payroll.payrollMonth = payrollMonthKey(payroll.payDate);
    }
    pushAudit(payroll, "approved", req.user, "");
    await payroll.save();
    await recoverAdvancesForPayroll(payroll._id);

    let payslip = null;
    try {
      payslip = await upsertPayslipFromPayroll(payroll);
      payroll.payslipLink = String(payslip._id);
      await payroll.save();
    } catch (err) {
      console.error("payslip on approve", err);
    }

    const populated = await Payroll.findById(payroll._id)
      .populate({ path: "employee", select: "name employeeId email" })
      .populate({ path: "preparedBy", select: "name role" })
      .populate({ path: "approvedBy", select: "name role" });

    try {
      const empDoc =
        populated?.employee && populated.employee.email != null
          ? populated.employee
          : await Employee.findById(payroll.employee).select("name email");
      if (empDoc?._id) {
        notifyPayrollStatus({
          employee: empDoc,
          payroll,
          status: "approved",
          decidedByName: req.user?.name || "",
        });
      }
    } catch (err) {
      console.error("payslip notify", err);
    }

    logActivity({
      actor: payroll.employee,
      action: "Payroll approved",
      type: "payroll",
      meta: {
        payrollId: String(payroll._id),
        payrollMonth: payroll.payrollMonth || "",
        netSalary: payroll.netSalary,
        approvedBy: String(actorId(req.user) || ""),
        approvedByName: req.user?.name || "",
      },
    });

    return res.json({
      status: true,
      message: payslip
        ? "Payroll approved — payslip generated"
        : "Payroll approved",
      data: serializePayroll(populated),
    });
  } catch (err) {
    console.error("approvePayroll", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const rejectPayroll = async (req, res) => {
  try {
    if (!canApprovePayroll(req.user)) {
      return res.status(403).json({
        status: false,
        message: "Only Org HR can reject payroll records",
      });
    }

    const { id } = req.params;
    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return res.status(404).json({ status: false, message: "Payroll not found" });
    }
    if (payroll.status !== "pending") {
      return res.status(400).json({
        status: false,
        message: "Only pending payroll can be rejected",
      });
    }

    const monthKey = payroll.payrollMonth || payrollMonthKey(payroll.payDate);
    const lockErr = await assertMonthWritable(monthKey);
    if (lockErr) {
      return res.status(403).json({ status: false, message: lockErr });
    }

    payroll.status = "rejected";
    payroll.approvedBy = actorId(req.user);
    payroll.approvedAt = new Date();
    payroll.rejectionReason = req.body?.reason || "";
    pushAudit(payroll, "rejected", req.user, payroll.rejectionReason);
    await payroll.save();
    await reopenAdvancesForPayroll(payroll._id);
    payroll.advanceIds = [];
    await payroll.save();

    const populated = await Payroll.findById(payroll._id)
      .populate({ path: "employee", select: "name employeeId email" })
      .populate({ path: "preparedBy", select: "name role" })
      .populate({ path: "approvedBy", select: "name role" });

    try {
      const empDoc =
        populated?.employee && populated.employee.email != null
          ? populated.employee
          : await Employee.findById(payroll.employee).select("name email");
      if (empDoc?._id) {
        notifyPayrollStatus({
          employee: empDoc,
          payroll,
          status: "rejected",
          decidedByName: req.user?.name || "",
          reason: payroll.rejectionReason || "",
        });
      }
    } catch (err) {
      console.error("reject payroll notify", err);
    }

    logActivity({
      actor: payroll.employee,
      action: "Payroll rejected",
      type: "payroll",
      meta: {
        payrollId: String(payroll._id),
        payrollMonth: payroll.payrollMonth || "",
        reason: payroll.rejectionReason || "",
        rejectedBy: String(actorId(req.user) || ""),
        rejectedByName: req.user?.name || "",
      },
    });

    return res.json({
      status: true,
      message: "Payroll rejected",
      data: serializePayroll(populated),
    });
  } catch (err) {
    console.error("rejectPayroll", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};
