import mongoose from "mongoose";

/**
 * Salary advance recorded when the employee takes money before payday.
 *
 * Types:
 * - full: entire remaining balance deducted on next payroll
 * - installment: fixed monthly portion over installmentMonths
 *
 * Status: open → applied (linked to pending payroll) → recovered (fully paid)
 *          or back to open after approve if remainingAmount > 0
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
    /** Still to recover */
    remainingAmount: { type: Number, min: 0 },
    /** Amount linked on the current applied payroll */
    appliedAmount: { type: Number, default: 0 },
    /**
     * full = recover all remaining on next payroll
     * installment = recover monthlyInstallment each payroll until done
     */
    repaymentType: {
      type: String,
      enum: ["full", "installment"],
      default: "full",
      index: true,
    },
    /** Number of months to spread repayment (installment only) */
    installmentMonths: { type: Number, default: null, min: 2 },
    /** Planned deduction per payroll for installment advances */
    monthlyInstallment: { type: Number, default: null, min: 0 },
    /** How many payroll cycles have successfully recovered a slice */
    installmentsPaid: { type: Number, default: 0, min: 0 },
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
