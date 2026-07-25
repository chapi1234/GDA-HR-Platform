import Device from "../models/Device.js";
import Employee from "../models/Employee.js";
import { HR_AND_ABOVE, DEVICE_INVENTORY_ROLES } from "../utils/roles.js";
import { getScopedEmployeeIds } from "../utils/scope.js";
import {
  notifyDeviceApprovalRequested,
  notifyDeviceApprovalDecision,
  notifyDeviceAssigned,
} from "../utils/notifyDevice.js";

// Get all devices (HR+ scoped)
export const getDevices = async (req, res) => {
  try {
    if (!HR_AND_ABOVE.includes(req.user?.role)) {
      return res.status(403).json({ status: false, message: "Forbidden" });
    }
    const ids = await getScopedEmployeeIds(req.user);
    const filter =
      ids === null
        ? {}
        : {
            $or: [
              { assignedTo: { $in: ids } },
              { assignedTo: null },
              { assignedTo: { $exists: false } },
            ],
          };
    const devices = await Device.find(filter).populate("assignedTo");
    res.status(200).json({
      status: true,
      message: "Devices fetched successfully",
      data: devices || [],
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error,
    });
  }
};

// Get device by ID
export const getDeviceById = async (req, res) => {
  const { id } = req.params;
  try {
    const device = await Device.findById(id).populate("assignedTo");
    if (!device) {
      return res.status(404).json({
        status: false,
        message: "Device not found",
      });
    }
    res.status(200).json({
      status: true,
      message: "Device fetched successfully",
      data: device,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error,
    });
  }
};

// Create a new device
export const createDevice = async (req, res) => {
  try {
    const device = new Device(req.body);
    await device.save();
    res.status(201).json({
      status: true,
      message: "Device created successfully",
      data: device,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error,
    });
  }
};

// Update a device
export const updateDevice = async (req, res) => {
  const { id } = req.params;
  try {
    const device = await Device.findByIdAndUpdate(id, req.body, { new: true });
    if (!device) {
      return res.status(404).json({
        status: false,
        message: "Device not found",
      });
    }
    res.status(200).json({
      status: true,
      message: "Device updated successfully",
      data: device,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error,
    });
  }
};

// Delete a device
export const deleteDevice = async (req, res) => {
  const { id } = req.params;
  try {
    const device = await Device.findByIdAndDelete(id);
    if (!device) {
      return res.status(404).json({
        status: false,
        message: "Device not found",
      });
    }
    res.status(200).json({
      status: true,
      message: "Device deleted successfully",
      data: device,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error,
    });
  }
};

// Search devices by name/type/serialNumber
export const searchDevices = async (req, res) => {
  try {
    const { q } = req.query;
    const regex = new RegExp(q, "i");
    const devices = await Device.find({
      $or: [
        { name: regex },
        { type: regex },
        { serialNumber: regex },
        { brand: regex },
        { model: regex },
        { plateNumber: regex },
        { chassisNumber: regex },
        { otherType: regex },
      ],
    });
    if (!devices || devices.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No devices found",
      });
    }
    res.status(200).json({
      status: true,
      message: "Devices fetched successfully",
      data: devices,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error,
    });
  }
};

// Assign a device to an employee.
// HR/Admin/Superadmin assign directly; sector leads create a pending
// assignment that requires approval.
export const assignDevice = async (req, res) => {
  // device id can be provided as param or in body as deviceId
  const deviceId = req.params.id || req.body.deviceId;
  const { employeeId, assignedDate, location, notes, returnDueDate } = req.body;
  try {
    if (!deviceId) return res.status(400).json({ status: false, message: 'device id is required' });
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ status: false, message: 'Device not found' });
    }
    // validate employee exists and is within the assigner's scope
    let employee = null;
    if (employeeId) {
      employee = await Employee.findById(employeeId);
      if (!employee) return res.status(404).json({ status: false, message: 'Employee not found' });
      const scopedIds = await getScopedEmployeeIds(req.user);
      if (
        scopedIds !== null &&
        !scopedIds.map(String).includes(String(employeeId))
      ) {
        return res.status(403).json({
          status: false,
          message: 'You can only assign devices to employees in your scope',
        });
      }
    }

    const needsApproval = !DEVICE_INVENTORY_ROLES.includes(req.user?.role);
    const requesterId = req.user?._id || req.user?.id;

    // set assignment
    device.assignedTo = employeeId;
    device.assignedDate = assignedDate ? new Date(assignedDate) : new Date();
    device.returnDueDate = returnDueDate ? new Date(returnDueDate) : null;
    device.returnReminderSentAt = null;
    // record location when assigning (optional)
    if (location) device.location = location;
    device.status = needsApproval ? 'pending_approval' : 'assigned';
    device.requestedBy = needsApproval ? requesterId : null;
    // push history
    device.history = device.history || [];
    device.history.push({
      employee: employeeId,
      action: needsApproval ? 'requested' : 'assigned',
      date: device.assignedDate,
      notes: notes || '',
      location: device.location || null,
    });
    await device.save();
    const populated = await Device.findById(device._id).populate('assignedTo', 'name employeeId email');

    if (needsApproval) {
      const requester = await Employee.findById(requesterId).select('name');
      notifyDeviceApprovalRequested({
        device,
        employee,
        requesterName: requester?.name,
      });
      return res.status(200).json({
        status: true,
        message: 'Assignment submitted — pending HR approval',
        data: populated,
      });
    }

    notifyDeviceAssigned({ device, employee });
    return res.status(200).json({ status: true, message: 'Device assigned', data: populated });
  } catch (error) {
    return res.status(500).json({ status: false, message: 'Failed to assign device', error: String(error) });
  }
};

// Approve a pending assignment (HR/Admin/Superadmin)
export const approveAssignment = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ status: false, message: 'Device not found' });
    }
    if (device.status !== 'pending_approval') {
      return res.status(400).json({ status: false, message: 'Device has no pending assignment' });
    }
    const employee = device.assignedTo
      ? await Employee.findById(device.assignedTo)
      : null;
    const requesterId = device.requestedBy;

    device.status = 'assigned';
    device.requestedBy = null;
    device.history.push({
      employee: device.assignedTo,
      action: 'approved',
      date: new Date(),
      notes: req.body?.notes || '',
    });
    await device.save();
    const populated = await Device.findById(device._id).populate('assignedTo', 'name employeeId email');

    const approver = await Employee.findById(req.user?._id || req.user?.id).select('name');
    notifyDeviceApprovalDecision({
      device,
      employee,
      requesterId,
      approved: true,
      decidedByName: approver?.name,
    });
    return res.status(200).json({ status: true, message: 'Assignment approved', data: populated });
  } catch (error) {
    return res.status(500).json({ status: false, message: 'Failed to approve assignment', error: String(error) });
  }
};

// Reject a pending assignment (HR/Admin/Superadmin) — device goes back to available
export const rejectAssignment = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ status: false, message: 'Device not found' });
    }
    if (device.status !== 'pending_approval') {
      return res.status(400).json({ status: false, message: 'Device has no pending assignment' });
    }
    const employee = device.assignedTo
      ? await Employee.findById(device.assignedTo)
      : null;
    const requesterId = device.requestedBy;

    device.history.push({
      employee: device.assignedTo,
      action: 'rejected',
      date: new Date(),
      notes: req.body?.notes || '',
    });
    device.assignedTo = null;
    device.assignedDate = null;
    device.returnDueDate = null;
    device.returnReminderSentAt = null;
    device.requestedBy = null;
    device.status = 'available';
    await device.save();

    const approver = await Employee.findById(req.user?._id || req.user?.id).select('name');
    notifyDeviceApprovalDecision({
      device,
      employee,
      requesterId,
      approved: false,
      decidedByName: approver?.name,
    });
    return res.status(200).json({ status: true, message: 'Assignment rejected', data: device });
  } catch (error) {
    return res.status(500).json({ status: false, message: 'Failed to reject assignment', error: String(error) });
  }
};

// Mark a device as returned
export const returnDevice = async (req, res) => {
  const deviceId = req.params.id || req.body.deviceId;
  const { returnDate, notes } = req.body;
  try {
    if (!deviceId) return res.status(400).json({ status: false, message: 'device id is required' });
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ status: false, message: 'Device not found' });
    }
    // Scoped roles may only return devices held by employees in their scope
    if (device.assignedTo) {
      const scopedIds = await getScopedEmployeeIds(req.user);
      if (
        scopedIds !== null &&
        !scopedIds.map(String).includes(String(device.assignedTo))
      ) {
        return res.status(403).json({
          status: false,
          message: 'You can only manage devices held by employees in your scope',
        });
      }
    }
    const returnedAt = returnDate ? new Date(returnDate) : new Date();
    device.returnDate = returnedAt;
    // record history using previously assigned employee if present
    const actorEmployee = device.assignedTo;
    device.history = device.history || [];
    device.history.push({ employee: actorEmployee, action: 'returned', date: returnedAt, notes: notes || '' });
    // clear assignment
    device.assignedTo = null;
    device.assignedDate = null;
    device.returnDueDate = null;
    device.returnReminderSentAt = null;
    device.requestedBy = null;
    device.status = 'available';
    await device.save();
    const populated = await Device.findById(device._id).populate('assignedTo', 'name employeeId email');
    return res.status(200).json({ status: true, message: 'Device returned', data: populated });
  } catch (error) {
    return res.status(500).json({ status: false, message: 'Failed to return device', error: String(error) });
  }
};

// Get devices for current user; HR/Admin/Superadmin get scoped inventory
export const getMyDevices = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ status: false, message: 'Unauthorized' });

    if (HR_AND_ABOVE.includes(req.user?.role)) {
      const ids = await getScopedEmployeeIds(req.user);
      const filter =
        ids === null
          ? {}
          : {
              $or: [
                { assignedTo: { $in: ids } },
                { assignedTo: null },
                { assignedTo: { $exists: false } },
              ],
            };
      const devices = await Device.find(filter).populate('assignedTo', 'name employeeId email');
      return res.status(200).json({ status: true, message: 'Devices fetched', data: devices });
    }

    const devices = await Device.find({ assignedTo: userId }).populate(
      'assignedTo',
      'name employeeId email'
    );
    return res.status(200).json({ status: true, message: 'My devices', data: devices });
  } catch (error) {
    return res.status(500).json({ status: false, message: 'Failed to fetch devices', error: String(error) });
  }
};
