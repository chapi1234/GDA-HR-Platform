import Leave from "../models/Leave.js";
import Employee from "../models/Employee.js";
import Notification from "../models/Notification.js";
import { emitToUser } from "../socket.js";
import {
  canAccessEmployee,
  canManageTeam,
  getScopedEmployeeIds,
} from "../utils/scope.js";
import { logActivity } from "../utils/logActivity.js";

const VALID_TYPES = [
  "vacation",
  "sick",
  "personal",
  "maternity",
  "paternity",
  "bereavement",
  "unpaid",
];

/** Inclusive calendar-day count from YYYY-MM-DD (or Date) strings. */
function calcDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end < start) return null;
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

/** Leaves that overlap calendar month `YYYY-MM`. */
function monthOverlapFilter(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  const monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return {
    startDate: { $lte: monthEnd },
    endDate: { $gte: monthStart },
  };
}

function leavePopulate() {
  return [
    {
      path: "employee",
      select:
        "name employeeId profileImage sectorId subSectorId subSubSectorId scopeLevel",
      populate: [
        { path: "sectorId", select: "name pathNames" },
        { path: "subSectorId", select: "name pathNames" },
      ],
    },
    { path: "manager", select: "name" },
  ];
}

// Create a new leave request (employee / any staff for themselves)
export const createLeave = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { type, startDate, endDate, reason } = req.body;
    if (!type || !startDate || !endDate || !reason) {
      return res
        .status(400)
        .json({ status: false, message: "All fields are required." });
    }
    if (!VALID_TYPES.includes(type)) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid leave type." });
    }
    const days = calcDays(startDate, endDate);
    if (days == null) {
      return res.status(400).json({
        status: false,
        message: "Invalid dates. End date must be on or after start date.",
      });
    }
    const leave = new Leave({
      employee: userId,
      type,
      startDate,
      endDate,
      days,
      reason,
      status: "pending",
    });
    await leave.save();
    const populated = await leave.populate(leavePopulate());
    logActivity({
      actor: userId,
      action: "Submitted leave request",
      type: "leave",
      meta: {
        leaveId: String(leave._id),
        leaveType: type,
        startDate,
        endDate,
        days,
      },
    });
    return res.status(201).json({
      status: true,
      message: "Leave request submitted.",
      data: populated,
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Failed to submit leave request",
      error: err.message,
    });
  }
};

// List leave requests scoped by role / org unit
// Optional query: month=YYYY-MM (leaves overlapping that month)
export const listLeaves = async (req, res) => {
  try {
    const populate = leavePopulate();
    const monthFilter = monthOverlapFilter(req.query.month);
    const base = monthFilter ? { ...monthFilter } : {};

    if (!canManageTeam(req.user)) {
      const leaves = await Leave.find({
        ...base,
        employee: req.user?._id || req.user?.id,
      })
        .populate(populate)
        .sort({ createdAt: -1 });
      return res.status(200).json({ status: true, data: leaves });
    }

    const scopedIds = await getScopedEmployeeIds(req.user);
    const query =
      scopedIds === null
        ? { ...base }
        : { ...base, employee: { $in: scopedIds } };

    const leaves = await Leave.find(query)
      .populate(populate)
      .sort({ createdAt: -1 });

    return res.status(200).json({ status: true, data: leaves });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch leave requests",
      error: err.message,
    });
  }
};

// Approve or reject (manager+/HR) — only within scope, pending only
export const reviewLeave = async (req, res) => {
  try {
    if (!canManageTeam(req.user)) {
      return res.status(403).json({ status: false, message: "Forbidden" });
    }
    const { id } = req.params;
    const { status, comments } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ status: false, message: "Invalid status" });
    }
    const leave = await Leave.findById(id);
    if (!leave) {
      return res
        .status(404)
        .json({ status: false, message: "Leave request not found" });
    }
    if (leave.status !== "pending") {
      return res.status(400).json({
        status: false,
        message: "Only pending leave requests can be reviewed",
      });
    }

    const employee = await Employee.findById(leave.employee);
    if (!employee || !canAccessEmployee(req.user, employee)) {
      return res.status(403).json({
        status: false,
        message: "You can only review leave within your organizational unit",
      });
    }

    leave.status = status;
    leave.comments = comments || "";
    leave.approvalDate = new Date();
    leave.manager = req.user?._id || req.user?.id;
    await leave.save();
    const populated = await leave.populate([
      { path: "employee", select: "name employeeId profileImage" },
      { path: "manager", select: "name" },
    ]);

    logActivity({
      actor: leave.employee,
      action:
        status === "approved"
          ? "Leave request approved"
          : "Leave request rejected",
      type: "leave",
      meta: {
        leaveId: String(leave._id),
        leaveType: leave.type,
        status,
        reviewedBy: String(req.user?._id || req.user?.id || ""),
        reviewedByName: req.user?.name || "",
      },
    });

    try {
      const recipientId = leave.employee;
      const title =
        status === "approved" ? "Leave approved" : "Leave rejected";
      const description =
        status === "approved"
          ? `Your ${leave.type} leave request was approved.`
          : `Your ${leave.type} leave request was rejected.`;
      const row = await Notification.create({
        recipient: recipientId,
        kind: "leave_reviewed",
        title,
        description,
        href: "/leave-requests",
        meta: { leaveId: String(leave._id), status },
      });
      emitToUser(recipientId, "notify:personal", {
        id: String(row._id),
        kind: "leave_reviewed",
        title,
        description,
        href: "/leave-requests",
        createdAt: (row.createdAt || new Date()).toISOString(),
      });
    } catch (notifyErr) {
      console.error("leave review notify", notifyErr);
    }

    return res
      .status(200)
      .json({ status: true, message: `Leave ${status}`, data: populated });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Failed to review leave",
      error: err.message,
    });
  }
};

export const updateLeave = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;
    const { type, startDate, endDate, reason } = req.body;
    const leave = await Leave.findOne({
      _id: id,
      employee: userId,
      status: "pending",
    });
    if (!leave) {
      return res
        .status(404)
        .json({ status: false, message: "Leave not found or not editable" });
    }
    if (type) {
      if (!VALID_TYPES.includes(type)) {
        return res
          .status(400)
          .json({ status: false, message: "Invalid leave type." });
      }
      leave.type = type;
    }
    if (startDate) leave.startDate = startDate;
    if (endDate) leave.endDate = endDate;
    if (reason) leave.reason = reason;
    const days = calcDays(leave.startDate, leave.endDate);
    if (days == null) {
      return res.status(400).json({
        status: false,
        message: "Invalid dates. End date must be on or after start date.",
      });
    }
    leave.days = days;
    await leave.save();
    const populated = await leave.populate([
      { path: "employee", select: "name employeeId profileImage" },
      { path: "manager", select: "name" },
    ]);
    return res
      .status(200)
      .json({ status: true, message: "Leave updated", data: populated });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Failed to update leave",
      error: err.message,
    });
  }
};

export const deleteLeave = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;
    const leave = await Leave.findOneAndDelete({
      _id: id,
      employee: userId,
      status: "pending",
    });
    if (!leave) {
      return res
        .status(404)
        .json({ status: false, message: "Leave not found or not deletable" });
    }
    logActivity({
      actor: userId,
      action: "Cancelled leave request",
      type: "leave",
      meta: {
        leaveId: String(leave._id),
        leaveType: leave.type,
      },
    });
    return res.status(200).json({ status: true, message: "Leave deleted" });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Failed to delete leave",
      error: err.message,
    });
  }
};
