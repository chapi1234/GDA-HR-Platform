import Activity from "../models/Activity.js";

/**
 * Fire-and-forget activity log (never throws to callers).
 * @param {{ actor: unknown, action: string, type?: string, meta?: object }} opts
 */
export async function logActivity({ actor, action, type = "general", meta = {} }) {
  try {
    if (!actor || !action) return null;
    const row = await Activity.create({
      actor,
      action,
      type,
      meta: meta || {},
    });
    return row;
  } catch (err) {
    console.error("logActivity", err?.message || err);
    return null;
  }
}

/** Start of the rolling window used by the dashboard activity feed. */
export function activitySinceDate(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(1, Number(days) || 7));
  d.setHours(0, 0, 0, 0);
  return d;
}
