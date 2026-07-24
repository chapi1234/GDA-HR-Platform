import mongoose from "mongoose";

const payrollSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    employeeId: { type: String },
    employeeName: { type: String },
    department: { type: String },
    position: { type: String },
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
    payPeriod: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },
    payDate: { type: Date, required: true },

    // GaDA payroll sheet columns
    basicSalary: { type: Number, required: true, default: 0 },
    houseAllowance: { type: Number, default: 0 },
    telephone: { type: Number, default: 0 },
    transportAllowance: { type: Number, default: 0 },
    /** Employer pension contribution (GaDA 11%) — reported, not deducted from net */
    pensionGada: { type: Number, default: 0 },
    /** Employee pension 11% — included in total deduction */
    pensionEmployee: { type: Number, default: 0 },
    grossSalary: { type: Number, required: true, default: 0 },
    incomeTax: { type: Number, default: 0 },
    membershipFee: { type: Number, default: 0 },
    salaryAdvance: { type: Number, default: 0 },
    /** Advances applied on this payroll row */
    advanceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SalaryAdvance",
      },
    ],
    other: { type: Number, default: 0 },
    totalDeduction: { type: Number, required: true, default: 0 },
    netSalary: { type: Number, required: true, default: 0 },

    // Legacy fields kept for older records / payslip compatibility
    bonus: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "paid"],
      default: "pending",
      index: true,
    },
    preparedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
    notes: { type: String, default: "" },
    payslipLink: String,
    /** Canonical YYYY-MM from payDate — used for one-row-per-employee-per-month */
    payrollMonth: { type: String, index: true },
    paidAt: { type: Date, default: null },
    paymentReference: { type: String, default: "" },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    auditLog: [
      {
        action: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
        byName: String,
        at: { type: Date, default: Date.now },
        note: String,
      },
    ],
  },
  { timestamps: true }
);

payrollSchema.index({ payDate: -1, status: 1 });
/** At most one active (non-rejected) payroll per employee per calendar month */
payrollSchema.index(
  { employee: 1, payrollMonth: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "approved", "paid"] },
      payrollMonth: { $type: "string" },
    },
  }
);

export default mongoose.model("Payroll", payrollSchema);
