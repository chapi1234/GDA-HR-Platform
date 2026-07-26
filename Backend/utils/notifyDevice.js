import Employee from "../models/Employee.js";
import { sendEmail } from "../Email/sendEmail.js";
import getDeviceReturnDueMailOptions from "../Email/deviceReturnNotify.js";
import getDeviceAssignedMailOptions from "../Email/deviceAssignedNotify.js";
import {
  getDeviceApprovalRequestMailOptions,
  getDeviceApprovalDecisionMailOptions,
} from "../Email/deviceApprovalNotify.js";
import { persistAndEmit } from "./notifyEmployee.js";
import { DEVICE_INVENTORY_ROLES } from "./roles.js";

const deviceLabel = (device) =>
  device?.name || device?.deviceName || "a device";

const deviceSerial = (device) =>
  device?.serialNumber || device?.plateNumber || "";

/** Notify all org HR/Admin/Superadmin that a sector lead requested an assignment */
export async function notifyDeviceApprovalRequested({
  device,
  employee,
  requesterName,
}) {
  try {
    const approvers = await Employee.find({
      role: { $in: DEVICE_INVENTORY_ROLES },
      status: { $ne: "inactive" },
    }).select("_id name email");

    await Promise.all(
      approvers.map(async (a) => {
        await persistAndEmit({
          recipientId: a._id,
          kind: "device_assignment",
          title: "Device assignment awaiting approval",
          description: `${requesterName || "A sector lead"} requested to assign ${deviceLabel(
            device
          )} to ${employee?.name || "an employee"}.`,
          href: "/device-management",
          meta: { deviceId: String(device._id) },
        });

        if (a.email) {
          try {
            await sendEmail(
              getDeviceApprovalRequestMailOptions({
                email: a.email,
                approverName: a.name,
                requesterName,
                employeeName: employee?.name,
                deviceName: deviceLabel(device),
                serialNumber: deviceSerial(device),
              })
            );
          } catch (err) {
            console.error("device approval request email", err.message);
          }
        }
      })
    );
  } catch (err) {
    console.error("notifyDeviceApprovalRequested", err.message);
  }
}

/** Notify the requesting sector lead (and the employee on approval) of the decision */
export async function notifyDeviceApprovalDecision({
  device,
  employee,
  requesterId,
  approved,
  decidedByName,
}) {
  try {
    if (requesterId) {
      await persistAndEmit({
        recipientId: requesterId,
        kind: "device_assignment",
        title: approved
          ? "Device assignment approved"
          : "Device assignment rejected",
        description: `${decidedByName || "HR"} ${
          approved ? "approved" : "rejected"
        } assigning ${deviceLabel(device)} to ${employee?.name || "the employee"}.`,
        href: "/device-management",
        meta: { deviceId: String(device._id) },
      });

      const requester = await Employee.findById(requesterId).select("name email");
      if (requester?.email) {
        try {
          await sendEmail(
            getDeviceApprovalDecisionMailOptions({
              email: requester.email,
              name: requester.name,
              approved,
              deviceName: deviceLabel(device),
              employeeName: employee?.name,
              decidedByName,
            })
          );
        } catch (err) {
          console.error("device approval decision email", err.message);
        }
      }
    }
    if (approved && employee?._id) {
      await notifyDeviceAssigned({
        device,
        employee,
        assignedByName: decidedByName,
      });
    }
  } catch (err) {
    console.error("notifyDeviceApprovalDecision", err.message);
  }
}

/** Notify an employee that a device was directly assigned to them */
export async function notifyDeviceAssigned({
  device,
  employee,
  assignedByName,
}) {
  if (!employee?._id) return;
  try {
    await persistAndEmit({
      recipientId: employee._id,
      kind: "device_assignment",
      title: "Device assigned to you",
      description: `${deviceLabel(device)} has been assigned to you${
        device.returnDueDate
          ? ` — return by ${new Date(device.returnDueDate).toLocaleDateString()}`
          : ""
      }.`,
      href: "/my-devices",
      meta: { deviceId: String(device._id) },
    });

    const emp =
      employee.email != null
        ? employee
        : await Employee.findById(employee._id).select("name email");

    if (emp?.email) {
      try {
        await sendEmail(
          getDeviceAssignedMailOptions({
            email: emp.email,
            name: emp.name || employee.name,
            deviceName: deviceLabel(device),
            serialNumber: deviceSerial(device),
            returnDueDate: device.returnDueDate,
            assignedByName,
          })
        );
      } catch (err) {
        console.error("notifyDeviceAssigned email", err.message);
      }
    }
  } catch (err) {
    console.error("notifyDeviceAssigned", err.message);
  }
}

/** In-app + email reminder that a device return is due (or overdue) */
export async function notifyDeviceReturnDue({ device, employee, overdue }) {
  if (!employee?._id) return;

  await persistAndEmit({
    recipientId: employee._id,
    kind: "device_return_due",
    title: overdue ? "Device return overdue" : "Device return due today",
    description: `Please return ${deviceLabel(device)}${
      device.returnDueDate
        ? ` (due ${new Date(device.returnDueDate).toLocaleDateString()})`
        : ""
    }.`,
    href: "/my-devices",
    meta: { deviceId: String(device._id) },
  });

  if (employee.email) {
    try {
      await sendEmail(
        getDeviceReturnDueMailOptions({
          email: employee.email,
          name: employee.name,
          deviceName: device.name,
          serialNumber: device.serialNumber || device.plateNumber || "",
          dueDate: device.returnDueDate,
          overdue,
        })
      );
    } catch (err) {
      console.error("notifyDeviceReturnDue email", err.message);
    }
  }
}
