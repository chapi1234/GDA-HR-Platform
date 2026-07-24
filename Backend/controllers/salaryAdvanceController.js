import SalaryAdvance from "../models/SalaryAdvance.js";
import Employee from "../models/Employee.js";
import { canAccessEmployee, getScopedEmployeeIds } from "../utils/scope.js";
import { isOrgWide, ROLES } from "../utils/roles.js";
import { notifySalaryAdvanceRecorded } from "../utils/notifyEmployee.js";

function actorId(user) {
  return user?._id || user?.id;
}

function canCreateAdvance(user) {
  if (!user) return false;
  if (user.role === ROLES.HR && isOrgWide(user)) return true;
  if (user.role === ROLES.MANAGER) return true;
  return false;
}

function canMutateAdvance(user) {
  if (!user) return false;
  if (user.role === ROLES.MANAGER) return true;
  if (user.role === ROLES.HR && isOrgWide(user)) return true;
  return false;
}

function canViewTeamAdvances(user) {
  return [
    ROLES.MANAGER,
    ROLES.UNIT_MANAGER,
    ROLES.SECTOR_LEAD,
    ROLES.HR,
    ROLES.ADMIN,
    ROLES.SUPERADMIN,
  ].includes(user?.role);
}

function serializeAdvance(doc) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  obj.id = obj._id;
  return obj;
}

export const createAdvance = async (req, res) => {
  try {
    if (!canCreateAdvance(req.user)) {
      return res.status(403).json({
        status: false,
        message: "Only Sub-sector Managers or Org HR can record salary advances",
      });
    }

    const { employee, employeeId, amount, takenDate, reason } = req.body;
    if ((!employee && !employeeId) || amount == null || !takenDate) {
      return res.status(400).json({
        status: false,
        message: "Required: employee, amount, takenDate",
      });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({
        status: false,
        message: "Amount must be greater than zero",
      });
    }

    let empDoc = null;
    if (employee && /^[0-9a-fA-F]{24}$/.test(String(employee))) {
      empDoc = await Employee.findById(employee);
    } else if (employeeId) {
      empDoc = await Employee.findOne({ employeeId });
    }
    if (!empDoc) {
      return res.status(404).json({ status: false, message: "Employee not found" });
    }
    if (!canAccessEmployee(req.user, empDoc)) {
      return res.status(403).json({
        status: false,
        message: "Outside your organizational scope",
      });
    }
    if (req.user.role === ROLES.MANAGER) {
      if (
        !req.user.subSectorId ||
        String(empDoc.subSectorId || "") !== String(req.user.subSectorId)
      ) {
        return res.status(403).json({
          status: false,
          message: "Managers can only record advances for their sub-sector",
        });
      }
    }

    const advance = await SalaryAdvance.create({
      employee: empDoc._id,
      employeeId: empDoc.employeeId,
      employeeName: empDoc.name,
      sectorId: empDoc.sectorId || null,
      subSectorId: empDoc.subSectorId || null,
      subSubSectorId: empDoc.subSubSectorId || null,
      amount: Number(amount),
      remainingAmount: Number(amount),
      appliedAmount: 0,
      takenDate: new Date(takenDate),
      reason: reason || "",
      status: "open",
      preparedBy: actorId(req.user),
    });

    const populated = await SalaryAdvance.findById(advance._id).populate({
      path: "preparedBy",
      select: "name role",
    });

    notifySalaryAdvanceRecorded({
      employee: empDoc,
      advance: populated || advance,
      preparedByName: req.user?.name || populated?.preparedBy?.name,
    }).catch((err) => console.error("advance notify", err));

    return res.status(201).json({
      status: true,
      message: "Salary advance recorded",
      data: serializeAdvance(populated),
    });
  } catch (err) {
    console.error("createAdvance", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const getAdvances = async (req, res) => {
  try {
    const { status, employee } = req.query;
    let query = {};

    if (canViewTeamAdvances(req.user)) {
      const scopedIds = await getScopedEmployeeIds(req.user);
      if (scopedIds !== null) query.employee = { $in: scopedIds };
    } else {
      query.employee = actorId(req.user);
    }

    if (status && status !== "all") query.status = status;
    if (employee && /^[0-9a-fA-F]{24}$/.test(String(employee))) {
      query.employee = employee;
    }

    const rows = await SalaryAdvance.find(query)
      .populate({ path: "preparedBy", select: "name role" })
      .populate({ path: "payroll", select: "payDate status netSalary" })
      .sort({ takenDate: -1, createdAt: -1 });

    return res.json({
      status: true,
      data: rows.map(serializeAdvance),
    });
  } catch (err) {
    console.error("getAdvances", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

/** Open advances for one employee (used by payroll form) */
export const getOpenAdvancesForEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!/^[0-9a-fA-F]{24}$/.test(String(employeeId))) {
      return res.status(400).json({ status: false, message: "Invalid employee id" });
    }

    const emp = await Employee.findById(employeeId);
    if (!emp) {
      return res.status(404).json({ status: false, message: "Employee not found" });
    }
    if (!canAccessEmployee(req.user, emp) && !canViewTeamAdvances(req.user)) {
      return res.status(403).json({ status: false, message: "Access denied" });
    }
    if (canViewTeamAdvances(req.user) && !canAccessEmployee(req.user, emp)) {
      return res.status(403).json({ status: false, message: "Outside your scope" });
    }

    const { payrollId } = req.query;
    const statusFilter = [{ status: "open" }];
    if (payrollId && /^[0-9a-fA-F]{24}$/.test(String(payrollId))) {
      statusFilter.push({ status: "applied", payroll: payrollId });
    }

    const rows = await SalaryAdvance.find({
      employee: employeeId,
      $or: statusFilter,
    }).sort({ takenDate: 1 });

    const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

    return res.json({
      status: true,
      data: rows.map(serializeAdvance),
      meta: { totalOpen: total, count: rows.length },
    });
  } catch (err) {
    console.error("getOpenAdvancesForEmployee", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const updateAdvance = async (req, res) => {
  try {
    const { id } = req.params;
    const advance = await SalaryAdvance.findById(id);
    if (!advance) {
      return res.status(404).json({ status: false, message: "Advance not found" });
    }
    if (!canMutateAdvance(req.user)) {
      return res.status(403).json({
        status: false,
        message: "Only Sub-sector Managers or Org HR can update open advances",
      });
    }
    if (advance.status !== "open") {
      return res.status(400).json({
        status: false,
        message: "Only open advances can be updated",
      });
    }

    const emp = await Employee.findById(advance.employee);
    if (!emp || !canAccessEmployee(req.user, emp)) {
      return res.status(403).json({ status: false, message: "Outside your scope" });
    }
    if (req.user.role === ROLES.MANAGER) {
      if (
        !req.user.subSectorId ||
        String(advance.subSectorId || "") !== String(req.user.subSectorId)
      ) {
        return res.status(403).json({
          status: false,
          message: "Managers can only update advances in their sub-sector",
        });
      }
    }

    if (req.body.amount != null) {
      if (Number(req.body.amount) <= 0) {
        return res.status(400).json({ status: false, message: "Invalid amount" });
      }
      advance.amount = Number(req.body.amount);
    }
    if (req.body.takenDate) advance.takenDate = new Date(req.body.takenDate);
    if (req.body.reason !== undefined) advance.reason = req.body.reason;

    await advance.save();
    return res.json({
      status: true,
      message: "Advance updated",
      data: serializeAdvance(advance),
    });
  } catch (err) {
    console.error("updateAdvance", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const cancelAdvance = async (req, res) => {
  try {
    const { id } = req.params;
    const advance = await SalaryAdvance.findById(id);
    if (!advance) {
      return res.status(404).json({ status: false, message: "Advance not found" });
    }
    if (!canMutateAdvance(req.user)) {
      return res.status(403).json({
        status: false,
        message: "Only Sub-sector Managers or Org HR can cancel open advances",
      });
    }
    if (advance.status !== "open") {
      return res.status(400).json({
        status: false,
        message: "Only open advances can be cancelled",
      });
    }

    const emp = await Employee.findById(advance.employee);
    if (!emp || !canAccessEmployee(req.user, emp)) {
      return res.status(403).json({ status: false, message: "Outside your scope" });
    }

    advance.status = "cancelled";
    await advance.save();
    return res.json({
      status: true,
      message: "Advance cancelled",
      data: serializeAdvance(advance),
    });
  } catch (err) {
    console.error("cancelAdvance", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};
