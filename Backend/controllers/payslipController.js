import Payslip from '../models/Payslip.js';
import Employee from '../models/Employee.js';
import { HR_AND_ABOVE } from '../utils/roles.js';
import { canAccessEmployee, getScopedEmployeeIds } from '../utils/scope.js';
import {
  monthLabelFromKey,
  payrollMonthKey,
} from '../utils/payrollMonth.js';

const isPayrollManager = (user) => HR_AND_ABOVE.includes(user?.role);

function serializePayslip(doc) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  obj.id = obj._id;
  return obj;
}

// GET /api/payslips
export const listPayslips = async (req, res) => {
  try {
    let payslips;
    if (isPayrollManager(req.user)) {
      const ids = await getScopedEmployeeIds(req.user);
      const filter = ids === null ? {} : { employee: { $in: ids } };
      payslips = await Payslip.find(filter)
        .populate('employee', 'name employeeId department position')
        .sort({ payDate: -1 });
    } else {
      payslips = await Payslip.find({ employee: req.user._id || req.user.id })
        .populate('employee', 'name employeeId department position')
        .sort({ payDate: -1 });
    }
    res.json({ status: true, data: payslips.map(serializePayslip) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: 'Server error listing payslips' });
  }
};

// GET /api/payslips/:id
export const getPayslip = async (req, res) => {
  try {
    const payslip = await Payslip.findById(req.params.id).populate(
      'employee',
      'name employeeId department position sectorId subSectorId subSubSectorId scopeLevel'
    );
    if (!payslip) return res.status(404).json({ status: false, message: 'Payslip not found' });

    const emp = payslip.employee;
    const isOwner =
      String(payslip.employee?._id || payslip.employee) ===
      String(req.user._id || req.user.id);

    if (!isOwner) {
      if (!isPayrollManager(req.user) || !canAccessEmployee(req.user, emp || { _id: payslip.employee })) {
        return res.status(403).json({ status: false, message: 'Forbidden' });
      }
    }

    res.json({ status: true, data: serializePayslip(payslip) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: 'Server error fetching payslip' });
  }
};

// POST /api/payslips (manual — prefer auto from payroll approve)
export const createPayslip = async (req, res) => {
  try {
    if (!isPayrollManager(req.user)) {
      return res.status(403).json({ status: false, message: 'Forbidden' });
    }
    const { employeeId, employee, payDate, salaryBreakdown, netSalary, grossSalary, deductions } =
      req.body;

    let emp = null;
    if (employee && /^[0-9a-fA-F]{24}$/.test(String(employee))) {
      emp = await Employee.findById(employee);
    } else if (employeeId) {
      emp = await Employee.findOne({ employeeId });
    }
    if (!emp) {
      return res.status(400).json({ status: false, message: 'Employee not found' });
    }
    if (!canAccessEmployee(req.user, emp)) {
      return res.status(403).json({ status: false, message: 'Employee is outside your organizational scope' });
    }

    const pay = payDate ? new Date(payDate) : new Date();
    const monthKey = payrollMonthKey(pay);
    const monthLabel = monthLabelFromKey(monthKey);

    const payslip = await Payslip.create({
      employee: emp._id,
      employeeId: emp.employeeId,
      employeeName: emp.name,
      department: emp.department?.name || emp.unitPath || '',
      payDate: pay,
      payrollMonth: monthKey,
      month: monthLabel,
      period: monthLabel,
      salaryBreakdown: Array.isArray(salaryBreakdown) ? salaryBreakdown : [],
      grossSalary: Number(grossSalary || 0),
      netSalary: Number(netSalary || 0),
      deductions: Number(deductions || 0),
      status: 'unpaid',
    });

    const populated = await payslip.populate('employee', 'name employeeId');
    res.status(201).json({ status: true, message: 'Payslip created', data: serializePayslip(populated) });
  } catch (err) {
    console.error(err);
    if (err?.code === 11000) {
      return res.status(409).json({
        status: false,
        message: 'A payslip already exists for this employee in that month',
      });
    }
    res.status(500).json({ status: false, message: 'Server error creating payslip' });
  }
};

// DELETE /api/payslips/:id
export const deletePayslip = async (req, res) => {
  try {
    if (!isPayrollManager(req.user)) {
      return res.status(403).json({ status: false, message: 'Forbidden' });
    }
    const payslip = await Payslip.findById(req.params.id).populate(
      'employee',
      'sectorId subSectorId subSubSectorId scopeLevel'
    );
    if (!payslip) return res.status(404).json({ status: false, message: 'Payslip not found' });
    if (!canAccessEmployee(req.user, payslip.employee || { _id: payslip.employee })) {
      return res.status(403).json({ status: false, message: 'Payslip is outside your organizational scope' });
    }
    await payslip.deleteOne();
    res.json({ status: true, message: 'Payslip deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: 'Server error deleting payslip' });
  }
};
