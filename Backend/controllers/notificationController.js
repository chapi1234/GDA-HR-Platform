import Notification from "../models/Notification.js";
import SalaryAdvance from "../models/SalaryAdvance.js";
import Payroll from "../models/Payroll.js";

function actorId(user) {
  return user?._id || user?.id;
}

function serialize(doc) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  obj.id = obj._id;
  // Keep links correct even for older rows
  if (obj.kind === "salary_advance") obj.href = "/salary-advances";
  if (obj.kind === "payroll_created") obj.href = "/salary";
  return obj;
}

/**
 * Backfill inbox rows for advances/payrolls created before notifications
 * were persisted (idempotent via meta ids).
 */
async function backfillFromRecords(uid) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [advances, payrolls, existing] = await Promise.all([
    SalaryAdvance.find({ employee: uid, createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
    Payroll.find({ employee: uid, createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
    Notification.find({ recipient: uid }).select("kind meta").lean(),
  ]);

  const advanceIds = new Set(
    existing
      .filter((n) => n.kind === "salary_advance" && n.meta?.advanceId)
      .map((n) => String(n.meta.advanceId))
  );
  const payrollIds = new Set(
    existing
      .filter((n) => n.kind === "payroll_created" && n.meta?.payrollId)
      .map((n) => String(n.meta.payrollId))
  );

  const toCreate = [];

  for (const a of advances) {
    const id = String(a._id);
    if (advanceIds.has(id)) continue;
    toCreate.push({
      recipient: uid,
      kind: "salary_advance",
      title: "Salary advance recorded",
      description: `An advance of ${Number(a.amount || 0).toLocaleString()} ETB was recorded in your name.`,
      href: "/salary-advances",
      meta: { advanceId: id, amount: a.amount },
      createdAt: a.createdAt,
      updatedAt: a.createdAt,
    });
  }

  for (const p of payrolls) {
    const id = String(p._id);
    if (payrollIds.has(id)) continue;
    toCreate.push({
      recipient: uid,
      kind: "payroll_created",
      title: "Payroll record created",
      description: `A payroll record (net ${Number(
        p.netSalary || 0
      ).toLocaleString()} ETB) was created in your name.`,
      href: "/salary",
      meta: { payrollId: id, netSalary: p.netSalary },
      createdAt: p.createdAt,
      updatedAt: p.createdAt,
    });
  }

  if (toCreate.length) {
    await Notification.insertMany(toCreate);
  }
}

/** Recent personal notifications for the logged-in employee */
export const getMyNotifications = async (req, res) => {
  try {
    const uid = actorId(req.user);
    if (!uid) {
      return res.status(401).json({ status: false, message: "Unauthorized" });
    }

    await backfillFromRecords(uid);

    const limit = Math.min(Number(req.query.limit) || 40, 100);
    // Inbox shows unread only — read notifications leave the list
    const rows = await Notification.find({ recipient: uid, readAt: null })
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json({
      status: true,
      data: rows.map(serialize),
    });
  } catch (err) {
    console.error("getMyNotifications", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const uid = actorId(req.user);
    const { id } = req.params;
    const row = await Notification.findOne({ _id: id, recipient: uid });
    if (!row) {
      return res.status(404).json({ status: false, message: "Not found" });
    }
    if (!row.readAt) {
      row.readAt = new Date();
      await row.save();
    }
    return res.json({ status: true, data: serialize(row) });
  } catch (err) {
    console.error("markNotificationRead", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const uid = actorId(req.user);
    await Notification.updateMany(
      { recipient: uid, readAt: null },
      { $set: { readAt: new Date() } }
    );
    return res.json({ status: true, message: "All marked read" });
  } catch (err) {
    console.error("markAllNotificationsRead", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};
