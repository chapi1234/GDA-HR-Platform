import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import Department from '../models/Department.js';
import DailyAttendance from '../models/DailyAttendance.js';
import { canAccessEmployee, employeeScopeFilter, getScopedEmployeeIds } from '../utils/scope.js';
import { logActivity } from '../utils/logActivity.js';

// Map DB doc to frontend shape used in Attendance.jsx
const mapRecord = (rec, empDoc) => {
  const emp = empDoc || rec.employee;
  const fullName = emp?.name || '';
  const unitPath =
    emp?.subSubSectorId?.pathNames?.join(' › ') ||
    emp?.subSectorId?.pathNames?.join(' › ') ||
    emp?.sectorId?.pathNames?.join(' › ') ||
    emp?.department?.name ||
    '';
  return {
    id: rec._id,
    employeeId: emp?.employeeId || (emp?._id?.toString() || ''),
    employeeName: fullName,
    avatar: emp?.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=3b82f6&color=fff`,
    department: unitPath,
    unitPath,
    date: new Date(rec.date).toISOString().split('T')[0],
    checkIn: rec.checkIn,
    checkOut: rec.checkOut,
    workingHours: computeWorkingHours(rec.checkIn, rec.checkOut),
    status: rec.status,
    location: rec.location,
  };
};

const employeePopulate = {
  path: 'employee',
  select: 'name employeeId profileImage department sectorId subSectorId subSubSectorId',
  populate: [
    { path: 'department', select: 'name' },
    { path: 'sectorId', select: 'name pathNames' },
    { path: 'subSectorId', select: 'name pathNames' },
    { path: 'subSubSectorId', select: 'name pathNames' },
  ],
};

const computeWorkingHours = (checkIn, checkOut) => {
  if (!checkIn && !checkOut) return '0h 00m';
  if (checkIn && !checkOut) return '0h 00m'; // ongoing; frontend can special-case
  try {
    const [h1, m1] = String(checkIn).split(':').map(Number);
    const [h2, m2] = String(checkOut).split(':').map(Number);
    let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (isNaN(mins) || mins < 0) mins = 0;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  } catch {
    return '0h 00m';
  }
};

const WORK_START_TIME = process.env.WORK_START_TIME || '09:00'; // HH:MM 24h

// normalize a date to the start/end of day
const dayBounds = (dateLike) => {
  const d = new Date(dateLike);
  const start = new Date(d); start.setHours(0,0,0,0);
  const end = new Date(d); end.setHours(23,59,59,999);
  return { start, end };
};

const isLateCheckIn = (checkIn) => {
  try {
    const [wh, wm] = String(WORK_START_TIME).split(':').map(Number);
    const [ch, cm] = String(checkIn).split(':').map(Number);
    if (isNaN(wh) || isNaN(wm) || isNaN(ch) || isNaN(cm)) return false;
    return ch > wh || (ch === wh && cm > wm);
  } catch { return false; }
};

// Ensure a DailyAttendance doc exists; optionally update counters delta
const bumpDaily = async (date, delta = {}) => {
  const { start } = dayBounds(date);
  const inc = {};
  for (const k of ['present','late','leave','absent']) {
    if (typeof delta[k] === 'number' && delta[k] !== 0) inc[k] = delta[k];
  }
  // Step 1: ensure doc exists (no $inc to avoid path conflicts on insert)
  await DailyAttendance.updateOne(
    { date: start },
    { $setOnInsert: { date: start, present: 0, late: 0, leave: 0, absent: 0 } },
    { upsert: true }
  );
  // Step 2: apply increments if any
  if (Object.keys(inc).length > 0) {
    await DailyAttendance.updateOne({ date: start }, { $inc: inc });
  }
  return DailyAttendance.findOne({ date: start });
};

// HR: list attendance for a specific date (default today)
export const listByDate = async (req, res) => {
  try {
    const { date } = req.query; // yyyy-mm-dd
    let target;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y,m,d] = date.split('-').map(Number);
      target = new Date(y, m-1, d, 0, 0, 0, 0); // local midnight
    } else {
      target = new Date();
    }
    const { start, end } = dayBounds(target);

    const scopedIds = await getScopedEmployeeIds(req.user);
    const attendanceQuery = { date: { $gte: start, $lte: end } };
    if (scopedIds !== null) {
      attendanceQuery.employee = { $in: scopedIds };
    }

    const recs = await Attendance.find(attendanceQuery)
      .populate(employeePopulate)
      .sort({ createdAt: -1 });
    const data = recs.map(r => mapRecord(r));

    // Augment with absent employees in scope (no record for the day)
    const employeeFilter = employeeScopeFilter(req.user);
    const allEmployees = await Employee.find(employeeFilter)
      .select('name employeeId profileImage department sectorId subSectorId subSubSectorId')
      .populate([
        { path: 'department', select: 'name' },
        { path: 'sectorId', select: 'name pathNames' },
        { path: 'subSectorId', select: 'name pathNames' },
        { path: 'subSubSectorId', select: 'name pathNames' },
      ]);
    const withRecord = new Set(recs.map(r => String(r.employee?._id || r.employee)));
    const formattedDate = start.toISOString().slice(0,10);
    for (const emp of allEmployees) {
      const idStr = String(emp._id);
      if (!withRecord.has(idStr)) {
        const unitPath =
          emp.subSubSectorId?.pathNames?.join(' › ') ||
          emp.subSectorId?.pathNames?.join(' › ') ||
          emp.sectorId?.pathNames?.join(' › ') ||
          emp.department?.name ||
          '';
        data.push({
          id: `absent:${idStr}:${start.getTime()}`,
          employeeId: emp.employeeId || idStr,
          employeeName: emp.name,
          avatar: emp.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=3b82f6&color=fff`,
          department: unitPath,
          unitPath,
          date: formattedDate,
          checkIn: null,
          checkOut: null,
          workingHours: '0h 00m',
          status: 'absent',
          location: null,
        });
      }
    }

    // Stats for the caller's visible scope (not written back unless org-wide)
    const present = data.filter(r => r.status === 'present').length;
    const late = data.filter(r => r.status === 'late').length;
    const leave = data.filter(r => r.status === 'leave').length;
    const absent = data.filter(r => r.status === 'absent').length;

    if (scopedIds === null) {
      await DailyAttendance.updateOne(
        { date: start },
        { $set: { date: start, present, late, leave, absent } },
        { upsert: true }
      );
    }

    return res.status(200).json({ status: true, message: 'Attendance for date', data, stats: {
      present,
      late,
      leave,
      absent,
      total: present + late + leave + absent
    }});
  } catch (err) {
    return res.status(500).json({ status: false, message: 'Failed to fetch attendance', error: err.message });
  }
};

// Self: my history (paginated)
export const myHistory = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id; // from authorize middleware
    if (!userId) return res.status(401).json({ status: false, message: 'Unauthorized' });

    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = { employee: userId };
    const total = await Attendance.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const safeSkip = (safePage - 1) * limit;

    const recs = await Attendance.find(filter)
      .sort({ date: -1 })
      .skip(safeSkip)
      .limit(limit);

    const emp = await Employee.findById(userId).populate({ path: 'department', select: 'name' });
    const data = recs.map(r => mapRecord(r, emp));

    return res.status(200).json({
      status: true,
      message: 'My attendance history',
      data,
      pagination: {
        page: safePage,
        limit,
        total,
        totalPages,
        hasNext: safePage < totalPages,
        hasPrev: safePage > 1,
      },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: 'Failed to fetch history', error: err.message });
  }
};

// Mark check-in (employee)
export const checkIn = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ status: false, message: 'Unauthorized' });
    const { time, location } = req.body; // e.g. '09:15'

    // create or upsert record for today
    const today = new Date();
    const { start, end } = dayBounds(today);

    let rec = await Attendance.findOne({ employee: userId, date: { $gte: start, $lte: end } });
    if (rec && rec.checkIn) {
      return res.status(400).json({ status: false, message: 'Already checked in for today.' });
    }
    const actualTime = time || currentTime();
    const late = isLateCheckIn(actualTime);
    if (!rec) {
      rec = new Attendance({ employee: userId, date: today, checkIn: actualTime, status: late ? 'late' : 'present', location: location || 'Office' });
      await bumpDaily(today, { [late ? 'late' : 'present']: 1 });
    } else {
      // Only set checkIn if not already set
      rec.checkIn = actualTime;
      const was = rec.status;
      if (!rec.status || rec.status === 'absent') {
        rec.status = late ? 'late' : 'present';
        await bumpDaily(today, { [late ? 'late' : 'present']: 1, ...(was === 'absent' ? { absent: -1 } : {}) });
      }
      if (location) rec.location = location;
    }
    await rec.save();
    // server-side activity log: create an activity for check-in
    logActivity({
      actor: userId,
      action: 'Checked in',
      type: 'attendance',
      meta: { date: start.toISOString().slice(0,10), checkIn: actualTime },
    });
    const emp = await Employee.findById(userId).populate({ path: 'department', select: 'name' });
    return res.status(200).json({ status: true, message: 'Checked in', data: mapRecord(rec, emp) });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: false, message: 'Failed to check in', error: err.message });
  }
};

// Mark check-out (employee)
export const checkOut = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ status: false, message: 'Unauthorized' });
    const { time } = req.body; // '18:30'
    const today = new Date();
    const { start, end } = dayBounds(today);
  const rec = await Attendance.findOne({ employee: userId, date: { $gte: start, $lte: end } });
  if (!rec) return res.status(404).json({ status: false, message: 'No attendance to check out' });
  if (!rec.checkIn) return res.status(400).json({ status: false, message: 'Cannot check out before checking in.' });
  if (rec.checkOut) return res.status(400).json({ status: false, message: 'Already checked out for today.' });
  rec.checkOut = time || currentTime();
  await rec.save();
  // server-side activity log: create an activity for check-out
  logActivity({
    actor: userId,
    action: 'Checked out',
    type: 'attendance',
    meta: { date: start.toISOString().slice(0,10), checkOut: rec.checkOut },
  });
  const emp = await Employee.findById(userId).populate({ path: 'department', select: 'name' });
  return res.status(200).json({ status: true, message: 'Checked out', data: mapRecord(rec, emp) });
  } catch (err) {
    return res.status(500).json({ status: false, message: 'Failed to check out', error: err.message });
  }
};

// HR: create or update a record for an employee/date
export const upsert = async (req, res) => {
  try {
    const { employeeId, date, checkIn, checkOut, status, location } = req.body;
    if (!employeeId || !date) return res.status(400).json({ status: false, message: 'employeeId and date required' });
    const emp = await Employee.findById(employeeId);
    if (!emp) return res.status(404).json({ status: false, message: 'Employee not found' });
    if (!canAccessEmployee(req.user, emp)) {
      return res.status(403).json({ status: false, message: 'Outside your organizational scope' });
    }
    const day = new Date(date);
    const { start, end } = dayBounds(day);
    let rec = await Attendance.findOne({ employee: emp._id, date: { $gte: start, $lte: end } });
    if (!rec) rec = new Attendance({ employee: emp._id, date: day });
    if (checkIn !== undefined) rec.checkIn = checkIn;
    if (checkOut !== undefined) rec.checkOut = checkOut;
    if (status !== undefined) rec.status = status;
    if (location !== undefined) rec.location = location;
    await rec.save();

    // Update daily counters from scratch for that day (safe approach)
    const dayRecs = await Attendance.find({ date: { $gte: start, $lte: end } });
    const present = dayRecs.filter(r => r.status === 'present').length;
    const late = dayRecs.filter(r => r.status === 'late').length;
    const leave = dayRecs.filter(r => r.status === 'leave').length;
    const totalEmployees = await Employee.countDocuments();
    const absent = Math.max(totalEmployees - (present + late + leave), 0);
    await DailyAttendance.updateOne(
      { date: start },
      { $set: { present, late, leave, absent } },
      { upsert: true }
    );
    const populated = await rec.populate({ path: 'employee', select: 'name employeeId profileImage department', populate: { path: 'department', select: 'name' } });
    return res.status(200).json({ status: true, message: 'Attendance saved', data: mapRecord(populated) });
  } catch (err) {
    return res.status(500).json({ status: false, message: 'Failed to upsert attendance', error: err.message });
  }
};

const currentTime = () => {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const computeWorkingMinutes = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  try {
    const [h1, m1] = String(checkIn).split(":").map(Number);
    const [h2, m2] = String(checkOut).split(":").map(Number);
    let mins = h2 * 60 + m2 - (h1 * 60 + m1);
    if (Number.isNaN(mins) || mins < 0) return 0;
    return mins;
  } catch {
    return 0;
  }
};

const formatMinutes = (mins) => {
  const total = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
};

const toYmdLocal = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Working weekdays (Mon–Fri) in a calendar month */
const workingDaysInMonth = (year, monthIndex0) => {
  const days = [];
  const end = new Date(year, monthIndex0 + 1, 0).getDate();
  for (let day = 1; day <= end; day++) {
    const d = new Date(year, monthIndex0, day);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) days.push(toYmdLocal(d));
  }
  return days;
};

/**
 * Monthly attendance summary per employee in scope.
 * Query: ?month=YYYY-MM
 */
export const monthlyReport = async (req, res) => {
  try {
    const monthKey = String(req.query.month || "").trim();
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return res.status(400).json({
        status: false,
        message: "month required as YYYY-MM",
      });
    }
    const [y, m] = monthKey.split("-").map(Number);
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    const workingDays = workingDaysInMonth(y, m - 1);
    const workingDaySet = new Set(workingDays);

    const employeeFilter = employeeScopeFilter(req.user);
    const employees = await Employee.find(employeeFilter)
      .select(
        "name employeeId profileImage department sectorId subSectorId subSubSectorId status"
      )
      .populate([
        { path: "department", select: "name" },
        { path: "sectorId", select: "name pathNames" },
        { path: "subSectorId", select: "name pathNames" },
        { path: "subSubSectorId", select: "name pathNames" },
      ])
      .sort({ name: 1 });

    const empIds = employees.map((e) => e._id);
    const recs = await Attendance.find({
      employee: { $in: empIds },
      date: { $gte: start, $lte: end },
    }).select("employee date checkIn checkOut status");

    const byEmp = new Map();
    for (const r of recs) {
      const id = String(r.employee);
      if (!byEmp.has(id)) byEmp.set(id, []);
      byEmp.get(id).push(r);
    }

    const data = employees.map((emp) => {
      const id = String(emp._id);
      const list = byEmp.get(id) || [];
      let present = 0;
      let late = 0;
      let leave = 0;
      let absentMarked = 0;
      let minutes = 0;
      const recordedWeekdays = new Set();

      for (const r of list) {
        const key = toYmdLocal(new Date(r.date));
        const onWorkingDay = workingDaySet.has(key);
        if (onWorkingDay) recordedWeekdays.add(key);
        const st = String(r.status || "").toLowerCase();
        // Summarize weekday attendance for monthly KPIs
        if (onWorkingDay) {
          if (st === "present") present += 1;
          else if (st === "late") late += 1;
          else if (st === "leave") leave += 1;
          else if (st === "absent") absentMarked += 1;
        }
        // Hours include any day they clocked (incl. weekend OT)
        minutes += computeWorkingMinutes(r.checkIn, r.checkOut);
      }

      let absentMissing = 0;
      for (const wd of workingDays) {
        if (!recordedWeekdays.has(wd)) absentMissing += 1;
      }
      const absent = absentMarked + absentMissing;
      const daysAttended = present + late;
      const workingDaysCount = workingDays.length;
      const attendanceRate =
        workingDaysCount > 0
          ? Math.round((daysAttended / workingDaysCount) * 100)
          : 0;

      const unitPath =
        emp.subSubSectorId?.pathNames?.join(" › ") ||
        emp.subSectorId?.pathNames?.join(" › ") ||
        emp.sectorId?.pathNames?.join(" › ") ||
        emp.department?.name ||
        "";

      return {
        employeeMongoId: id,
        employeeId: emp.employeeId || id,
        employeeName: emp.name || "",
        department: unitPath,
        workingDays: workingDaysCount,
        present,
        late,
        leave,
        absent,
        daysAttended,
        totalHours: formatMinutes(minutes),
        totalMinutes: minutes,
        attendanceRate,
      };
    });

    return res.json({
      status: true,
      data,
      meta: {
        month: monthKey,
        workingDays: workingDays.length,
        employeeCount: data.length,
      },
    });
  } catch (err) {
    console.error("monthlyReport", err);
    return res.status(500).json({
      status: false,
      message: "Failed to build monthly attendance report",
      error: err.message,
    });
  }
};

// Stats only: scoped for manager/HR sector; org-wide for superadmin/org roles
export const statsByDate = async (req, res) => {
  try {
    const { date } = req.query; // yyyy-mm-dd
    let target;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y,m,d] = date.split('-').map(Number);
      target = new Date(y, m-1, d, 0, 0, 0, 0);
    } else {
      target = new Date();
    }
    const { start, end } = dayBounds(target);
    const scopedIds = await getScopedEmployeeIds(req.user);
    const attendanceQuery = { date: { $gte: start, $lte: end } };
    if (scopedIds !== null) {
      attendanceQuery.employee = { $in: scopedIds };
    }
    const recs = await Attendance.find(attendanceQuery).select('status employee');
    const present = recs.filter(r => r.status === 'present').length;
    const late = recs.filter(r => r.status === 'late').length;
    const leave = recs.filter(r => r.status === 'leave').length;
    const totalEmployees =
      scopedIds === null
        ? await Employee.countDocuments()
        : scopedIds.length;
    const withRecord = new Set(recs.map((r) => String(r.employee)));
    const recorded = withRecord.size;
    const absent = Math.max(totalEmployees - recorded, 0);

    if (scopedIds === null) {
      await DailyAttendance.updateOne(
        { date: start },
        { $set: { date: start, present, late, leave, absent } },
        { upsert: true }
      );
    }

    return res.status(200).json({
      status: true,
      stats: { present, late, leave, absent, total: present + late + leave + absent },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: 'Failed to fetch stats', error: err.message });
  }
};
