import Employee from "../models/Employee.js";
import { sendEmail } from "../Email/sendEmail.js";
import getLeaveSubmittedMailOptions from "../Email/leaveSubmittedNotify.js";
import getLeaveReviewedMailOptions from "../Email/leaveReviewedNotify.js";
import { persistAndEmit } from "./notifyEmployee.js";
import { ROLES } from "./roles.js";

/** Managers / HR who should review leave for this employee */
export async function findLeaveApprovers(employee) {
  if (!employee) return [];
  const or = [
    { role: { $in: [ROLES.HR, ROLES.ADMIN, ROLES.SUPERADMIN] } },
  ];
  if (employee.sectorId) {
    or.push({ role: ROLES.SECTOR_LEAD, sectorId: employee.sectorId });
  }
  if (employee.subSectorId) {
    or.push({ role: ROLES.MANAGER, subSectorId: employee.subSectorId });
  }
  if (employee.subSubSectorId) {
    or.push({
      role: ROLES.UNIT_MANAGER,
      subSubSectorId: employee.subSubSectorId,
    });
  }

  return Employee.find({
    status: { $ne: "inactive" },
    $or: or,
  }).select("_id name email");
}

/** Notify approvers (in-app + email) when leave is submitted */
export async function notifyLeaveSubmitted({ employee, leave }) {
  if (!employee?._id || !leave) return;

  const approvers = await findLeaveApprovers(employee);
  const employeeName = employee.name || "An employee";

  await Promise.all(
    approvers.map(async (approver) => {
      if (String(approver._id) === String(employee._id)) return;

      await persistAndEmit({
        recipientId: approver._id,
        kind: "leave_submitted",
        title: "New leave request",
        description: `${employeeName} submitted a ${leave.type || "leave"} request for review.`,
        href: "/leave-requests",
        meta: { leaveId: String(leave._id) },
      });

      if (approver.email) {
        try {
          await sendEmail(
            getLeaveSubmittedMailOptions({
              email: approver.email,
              approverName: approver.name,
              employeeName,
              leaveType: leave.type,
              startDate: leave.startDate,
              endDate: leave.endDate,
              days: leave.days,
              reason: leave.reason,
            })
          );
        } catch (err) {
          console.error("notifyLeaveSubmitted email", err.message);
        }
      }
    })
  );
}

/** Notify the employee when leave is approved or rejected */
export async function notifyLeaveReviewed({
  employee,
  leave,
  status,
  comments,
  reviewedByName,
}) {
  if (!employee?._id || !leave) return;
  const approved = String(status).toLowerCase() === "approved";

  await persistAndEmit({
    recipientId: employee._id,
    kind: "leave_reviewed",
    title: approved ? "Leave approved" : "Leave rejected",
    description: approved
      ? `Your ${leave.type} leave request was approved.`
      : `Your ${leave.type} leave request was rejected.`,
    href: "/leave-requests",
    meta: { leaveId: String(leave._id), status },
  });

  if (employee.email) {
    try {
      await sendEmail(
        getLeaveReviewedMailOptions({
          email: employee.email,
          name: employee.name,
          leaveType: leave.type,
          startDate: leave.startDate,
          endDate: leave.endDate,
          days: leave.days,
          status,
          comments,
          reviewedByName,
        })
      );
    } catch (err) {
      console.error("notifyLeaveReviewed email", err.message);
    }
  }
}
