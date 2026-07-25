import Device from "../models/Device.js";
import { notifyDeviceReturnDue } from "./notifyDevice.js";

/**
 * Send return reminders for assigned devices whose due date has arrived.
 * Sends at most one reminder per device per day (in-app + email),
 * repeating daily while the device stays overdue.
 */
export async function checkDeviceReturnsDue() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const dueDevices = await Device.find({
    status: "assigned",
    assignedTo: { $ne: null },
    returnDueDate: { $ne: null, $lte: endOfToday },
    $or: [
      { returnReminderSentAt: null },
      { returnReminderSentAt: { $lt: startOfToday } },
    ],
  }).populate("assignedTo", "name email");

  for (const device of dueDevices) {
    const overdue = device.returnDueDate < startOfToday;
    try {
      await notifyDeviceReturnDue({
        device,
        employee: device.assignedTo,
        overdue,
      });
      device.returnReminderSentAt = new Date();
      await device.save();
    } catch (err) {
      console.error(
        `device return reminder failed for ${device._id}:`,
        err.message
      );
    }
  }

  if (dueDevices.length) {
    console.log(`Device return reminders sent: ${dueDevices.length}`);
  }
  return dueDevices.length;
}

/** Run shortly after boot, then hourly. */
export function startDeviceReminderJob() {
  const run = () =>
    checkDeviceReturnsDue().catch((err) =>
      console.error("device reminder job:", err.message)
    );
  setTimeout(run, 15 * 1000);
  setInterval(run, 60 * 60 * 1000);
}
