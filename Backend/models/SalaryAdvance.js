import mongoose from "mongoose";

/**
 * Salary advance recorded when the employee takes money before payday.
 * open → applied (linked to pending payroll) → recovered (payroll approved)
 */
const salaryAdvanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    employeeId: { type: String },
    employeeName: { type: String },
    sectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sector",
      default: null,
      index: true,
    },
    subSectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sector",
      default: null,
      index: true,
    },
    subSubSectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sector",
      default: null,
    },
    amount: { type: Number, required: true, min: 0 },
    /** Still to recover (supports installments across months) */
    remainingAmount: { type: Number, min: 0 },
    /** Amount linked on the current applied payroll */
    appliedAmount: { type: Number, default: 0 },
    takenDate: { type: Date, required: true },
    reason: { type: String, default: "" },
    status: {
      type: String,
      enum: ["open", "applied", "recovered", "cancelled"],
      default: "open",
      index: true,
    },
    preparedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    payroll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payroll",
      default: null,
    },
    appliedAt: { type: Date, default: null },
    recoveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

salaryAdvanceSchema.index({ employee: 1, status: 1, takenDate: -1 });

export default mongoose.model("SalaryAdvance", salaryAdvanceSchema);
