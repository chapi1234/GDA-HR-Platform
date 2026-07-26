import mongoose from "mongoose";

/**
 * Per-employee inbox items (salary advance / payroll alerts, etc.)
 */
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: [
        "salary_advance",
        "payroll_created",
        "payslip_ready",
        "payroll_rejected",
        "payroll_paid",
        "chat_message",
        "leave_submitted",
        "leave_reviewed",
        "device_assignment",
        "device_return_due",
        "general",
      ],
      default: "general",
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    href: { type: String, default: "/salary" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
