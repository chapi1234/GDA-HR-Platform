import Payroll from "../models/Payroll.js";
import Employee from "../models/Employee.js";
import SalaryAdvance from "../models/SalaryAdvance.js";
import PayrollMonthLock from "../models/PayrollMonthLock.js";
import Notification from "../models/Notification.js";
import { getScopedEmployeeIds } from "../utils/scope.js";
import { isOrgWide, ROLES } from "../utils/roles.js";
import { computePayrollSheet } from "../utils/payrollSheet.js";
import { applyAdvancesToPayroll } from "../utils/advanceApply.js";
import {
  notifyPayrollCreated,
  notifyPayrollStatus,
} from "../utils/notifyEmployee.js";
import { sendEmail } from "../Email/sendEmail.js";
import getPayrollReminderMailOptions from "../Email/payrollReminderNotify.js";
import {
  payrollMonthKey,
  monthLabelFromKey,
  monthRangeFromKey,
} from "../utils/payrollMonth.js";
import {
  pushAudit,
  assertMonthWritable,
  unpaidLeaveDeduction,
} from "../utils/payrollOps.js";
import {
  canApprovePayroll,
  canCreatePayroll,
  approvePayroll,
  rejectPayroll,
} from "./payrollController.js";
import { emitToUser } from "../socket.js";

function actorId(user) {
  return user?._id || user?.id;
}

async function assertNoDuplicateMonth(employeeId, payDate) {
  const month = payrollMonthKey(payDate);
  if (!month) return { error: "Invalid pay date" };
  const range = monthRangeFromKey(month);
  const existing = await Payroll.findOne({
    employee: employeeId,
    status: { $in: ["pending", "approved", "paid"] },
    $or: [
      { payrollMonth: month },
      {
        $or: [{ payrollMonth: null }, { payrollMonth: { $exists: false } }],
        payDate: { $gte: range.start, $lte: range.end },
      },
    ],
  }).select("status");
  if (existing) {
    return {
      error: `A ${existing.status} payroll already exists for this employee in ${monthLabelFromKey(month)}.`,
    };
  }
  return { month };
}

export const markPayrollPaid = async (req, res) => {
  try {
    if (!canApprovePayroll(req.user) && req.user.role !== ROLES.SUPERADMIN) {
      return res.status(403).json({
        status: false,
        message: "Only Org HR (or Super Admin) can mark payroll as paid",
      });
    }
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      return res.status(404).json({ status: false, message: "Not found" });
    }
    if (payroll.status !== "approved") {
      return res.status(400).json({
        status: false,
        message: "Only approved payroll can be marked as paid",
      });
    }
    const lockErr = await assertMonthWritable(
      payroll.payrollMonth || payrollMonthKey(payroll.payDate)
    );
    if (lockErr) return res.status(403).json({ status: false, message: lockErr });

    payroll.status = "paid";
    payroll.paidAt = req.body.paidAt ? new Date(req.body.paidAt) : new Date();
    payroll.paymentReference = req.body.paymentReference || "";
    payroll.paidBy = actorId(req.user);
    pushAudit(payroll, "paid", req.user, payroll.paymentReference);
    await payroll.save();

    try {
      const Payslip = (await import("../models/Payslip.js")).default;
      await Payslip.updateOne(
        { payroll: payroll._id },
        { $set: { status: "paid" } }
      );
    } catch (_) {
      /* ignore */
    }

    try {
      const emp = await Employee.findById(payroll.employee).select("name email");
      if (emp?._id) {
        notifyPayrollStatus({
          employee: emp,
          payroll,
          status: "paid",
          decidedByName: req.user?.name || "",
        });
      }
    } catch (err) {
      console.error("mark paid notify", err);
    }

    return res.json({ status: true, message: "Marked as paid", data: payroll });
  } catch (err) {
    console.error("markPayrollPaid", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const bulkApprovePayroll = async (req, res) => {
  try {
    if (!canApprovePayroll(req.user)) {
      return res.status(403).json({ status: false, message: "Only Org HR can bulk approve" });
    }
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    const results = { ok: [], failed: [] };
    for (const id of ids) {
      let captured = null;
      const fakeRes = {
        status(code) {
          captured = { code };
          return this;
        },
        json(payload) {
          captured = { ...(captured || {}), payload };
          return captured;
        },
      };
      await approvePayroll({ user: req.user, params: { id }, body: {} }, fakeRes);
      if (captured?.payload?.status) results.ok.push(id);
      else results.failed.push({ id, message: captured?.payload?.message || "failed" });
    }
    return res.json({ status: true, data: results });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const bulkRejectPayroll = async (req, res) => {
  try {
    if (!canApprovePayroll(req.user)) {
      return res.status(403).json({ status: false, message: "Only Org HR can bulk reject" });
    }
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    const reason = req.body.reason || "";
    const results = { ok: [], failed: [] };
    for (const id of ids) {
      let captured = null;
      const fakeRes = {
        status(code) {
          captured = { code };
          return this;
        },
        json(payload) {
          captured = { ...(captured || {}), payload };
          return captured;
        },
      };
      await rejectPayroll(
        { user: req.user, params: { id }, body: { reason } },
        fakeRes
      );
      if (captured?.payload?.status) results.ok.push(id);
      else results.failed.push({ id, message: captured?.payload?.message || "failed" });
    }
    return res.json({ status: true, data: results });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const batchCreatePayroll = async (req, res) => {
  try {
    if (!canCreatePayroll(req.user)) {
      return res.status(403).json({ status: false, message: "Forbidden" });
    }
    const month =
      req.body.payrollMonth || payrollMonthKey(req.body.payDate || new Date());
    const lockErr = await assertMonthWritable(month);
    if (lockErr) return res.status(403).json({ status: false, message: lockErr });

    const range = monthRangeFromKey(month);
    const payDate = req.body.payDate ? new Date(req.body.payDate) : range.end;

    let employees = [];
    if (req.user.role === ROLES.MANAGER && req.user.subSectorId) {
      employees = await Employee.find({
        subSectorId: req.user.subSectorId,
        status: "active",
      });
    } else if (req.user.role === ROLES.HR && isOrgWide(req.user)) {
      const ids = await getScopedEmployeeIds(req.user);
      const filter =
        ids === null
          ? { status: "active" }
          : { _id: { $in: ids }, status: "active" };
      employees = await Employee.find(filter);
    } else {
      return res.status(403).json({ status: false, message: "Forbidden" });
    }

    const created = [];
    const skipped = [];

    for (const emp of employees) {
      const basic = Number(emp.salary || 0);
      if (!basic) {
        skipped.push({ employee: emp.name, reason: "No salary on profile" });
        continue;
      }

      const dup = await assertNoDuplicateMonth(emp._id, payDate);
      if (dup.error) {
        skipped.push({ employee: emp.name, reason: dup.error });
        continue;
      }

      const leaveAdj = await unpaidLeaveDeduction(
        emp._id,
        basic,
        range.start,
        range.end
      );
      const openAdvances = await SalaryAdvance.find({
        employee: emp._id,
        status: "open",
      });
      const advanceIds = openAdvances.map((a) => String(a._id));
      const amounts = computePayrollSheet({
        basicSalary: basic,
        other: leaveAdj.amount || 0,
      });

      const payroll = new Payroll({
        employee: emp._id,
        employeeId: emp.employeeId,
        employeeName: emp.name,
        department: emp.unitPath || "",
        position: emp.position,
        sectorId: emp.sectorId || null,
        subSectorId: emp.subSectorId || null,
        subSubSectorId: emp.subSubSectorId || null,
        payDate,
        payPeriod: { startDate: range.start, endDate: range.end },
        payrollMonth: month,
        ...amounts,
        advanceIds: [],
        status: "pending",
        preparedBy: actorId(req.user),
        notes:
          leaveAdj.days > 0
            ? `Unpaid leave ${leaveAdj.days} day(s) → Other ${leaveAdj.amount}`
            : "Batch generated",
        auditLog: [],
      });
      pushAudit(payroll, "created_batch", req.user, month);
      await payroll.save();

      if (advanceIds.length) {
        const advanceResult = await applyAdvancesToPayroll({
          employeeId: emp._id,
          advanceIds,
          payrollId: payroll._id,
        });
        if (!advanceResult.error && advanceResult.advanceIds.length) {
          Object.assign(
            payroll,
            computePayrollSheet({
              ...amounts,
              salaryAdvance: advanceResult.salaryAdvanceTotal,
              other: leaveAdj.amount || 0,
            })
          );
          payroll.advanceIds = advanceResult.advanceIds;
          await payroll.save();
        }
      }

      notifyPayrollCreated({
        employee: emp,
        payroll,
        preparedByName: req.user?.name,
      }).catch(() => {});

      created.push({ id: payroll._id, employee: emp.name });
    }

    return res.status(201).json({
      status: true,
      message: `Batch created ${created.length} payroll(s)`,
      data: { created, skipped, payrollMonth: month },
    });
  } catch (err) {
    console.error("batchCreatePayroll", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const lockPayrollMonth = async (req, res) => {
  try {
    if (!canApprovePayroll(req.user) && req.user.role !== ROLES.SUPERADMIN) {
      return res.status(403).json({ status: false, message: "Only Org HR can lock a month" });
    }
    const month = req.body.payrollMonth;
    if (!month) {
      return res.status(400).json({ status: false, message: "payrollMonth required" });
    }
    const row = await PayrollMonthLock.findOneAndUpdate(
      { payrollMonth: month },
      {
        payrollMonth: month,
        lockedBy: actorId(req.user),
        lockedAt: new Date(),
        note: req.body.note || "",
      },
      { upsert: true, new: true }
    );
    return res.json({ status: true, message: `Month ${month} locked`, data: row });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const unlockPayrollMonth = async (req, res) => {
  try {
    if (req.user.role !== ROLES.SUPERADMIN && !canApprovePayroll(req.user)) {
      return res.status(403).json({ status: false, message: "Forbidden" });
    }
    const month = req.body.payrollMonth || req.params.month;
    await PayrollMonthLock.deleteOne({ payrollMonth: month });
    return res.json({ status: true, message: `Month ${month} unlocked` });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const getMonthLockStatus = async (req, res) => {
  try {
    const month = req.query.payrollMonth;
    const row = month
      ? await PayrollMonthLock.findOne({ payrollMonth: month })
      : null;
    return res.json({
      status: true,
      data: { payrollMonth: month, locked: !!row, lock: row },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const exportBankTransfer = async (req, res) => {
  try {
    const month = req.query.payrollMonth;
    if (!month) {
      return res.status(400).json({ status: false, message: "payrollMonth required" });
    }
    const query = {
      payrollMonth: month,
      status: { $in: ["approved", "paid"] },
    };
    const scoped = await getScopedEmployeeIds(req.user);
    if (scoped !== null) query.employee = { $in: scoped };

    const rows = await Payroll.find(query)
      .populate({
        path: "employee",
      select:
        "name employeeId bankName bankAccountName bankAccountNumber",
    })
      .sort({ employeeName: 1 });

    const data = rows.map((p, i) => {
      const e = p.employee || {};
      return {
        no: i + 1,
        employeeId: p.employeeId || e.employeeId || "",
        name: p.employeeName || e.name || "",
        bankName: e.bankName || "Commercial Bank of Ethiopia",
        accountName: e.bankAccountName || e.name || p.employeeName || "",
        accountNumber: e.bankAccountNumber || "",
        netSalary: Number(p.netSalary || 0),
        status: p.status,
      };
    });

    return res.json({
      status: true,
      data,
      payrollMonth: month,
      count: data.length,
    });
  } catch (err) {
    console.error("exportBankTransfer", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const sendMonthEndReminders = async (req, res) => {
  try {
    if (!canApprovePayroll(req.user) && req.user.role !== ROLES.SUPERADMIN) {
      return res.status(403).json({ status: false, message: "Forbidden" });
    }
    const month = req.body.payrollMonth || payrollMonthKey(new Date());
    const managers = await Employee.find({
      role: ROLES.MANAGER,
      status: "active",
      subSectorId: { $ne: null },
    });

    let sent = 0;
    for (const mgr of managers) {
      const staff = await Employee.find({
        subSectorId: mgr.subSectorId,
        status: "active",
      }).select("_id");
      const staffIds = staff.map((s) => s._id);
      const done = await Payroll.find({
        employee: { $in: staffIds },
        payrollMonth: month,
        status: { $in: ["pending", "approved", "paid"] },
      }).select("employee");
      const doneSet = new Set(done.map((d) => String(d.employee)));
      const missing = staffIds.filter((id) => !doneSet.has(String(id))).length;
      if (missing <= 0) continue;

      const title = "Payroll reminder";
      const description = `${missing} employee(s) in your sub-sector still need a ${monthLabelFromKey(
        month
      )} payroll row.`;
      const note = await Notification.create({
        recipient: mgr._id,
        kind: "general",
        title,
        description,
        href: "/salary",
        meta: { payrollMonth: month, missing },
      });
      emitToUser(mgr._id, "notify:personal", {
        id: String(note._id),
        kind: "payroll_reminder",
        title,
        description,
        href: "/salary",
        createdAt: note.createdAt.toISOString(),
      });
      if (mgr.email) {
        try {
          await sendEmail(
            getPayrollReminderMailOptions({
              email: mgr.email,
              name: mgr.name,
              payrollMonth: month,
              missingCount: missing,
            })
          );
        } catch (err) {
          console.error("payroll reminder email", err.message);
        }
      }
      sent += 1;
    }

    return res.json({
      status: true,
      message: `Reminders sent to ${sent} manager(s)`,
      data: { sent, payrollMonth: month },
    });
  } catch (err) {
    console.error("sendMonthEndReminders", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const previewUnpaidLeave = async (req, res) => {
  try {
    const { employeeId, basicSalary, payrollMonth } = req.query;
    if (!employeeId || !payrollMonth) {
      return res.status(400).json({
        status: false,
        message: "employeeId and payrollMonth required",
      });
    }
    const range = monthRangeFromKey(payrollMonth);
    const data = await unpaidLeaveDeduction(
      employeeId,
      Number(basicSalary || 0),
      range.start,
      range.end
    );
    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};
