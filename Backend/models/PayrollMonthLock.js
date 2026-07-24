import mongoose from "mongoose";

/** Org HR can lock a calendar month so no create/edit/approve/reject until unlocked */
const payrollMonthLockSchema = new mongoose.Schema(
  {
    payrollMonth: { type: String, required: true, unique: true },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    lockedAt: { type: Date, default: Date.now },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("PayrollMonthLock", payrollMonthLockSchema);
