import mongoose from "mongoose";

const SalaryBreakdownSchema = new mongoose.Schema({
  label: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ["earning", "deduction"], required: true },
});

const PayslipSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    payroll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payroll",
      default: null,
      index: true,
    },
    /** Display label e.g. "July 2026" */
    month: { type: String, required: true },
    /** Canonical key YYYY-MM */
    payrollMonth: { type: String, index: true },
    period: { type: String, required: true },
    employeeId: { type: String },
    employeeName: { type: String },
    department: { type: String },
    grossSalary: { type: Number, required: true },
    netSalary: { type: Number, required: true },
    deductions: { type: Number, required: true },
    status: { type: String, enum: ["paid", "unpaid"], default: "unpaid" },
    payDate: { type: Date, required: true },
    downloadUrl: { type: String },
    salaryBreakdown: [SalaryBreakdownSchema],
  },
  { timestamps: true }
);

PayslipSchema.index(
  { employee: 1, payrollMonth: 1 },
  {
    unique: true,
    partialFilterExpression: { payrollMonth: { $type: "string" } },
  }
);

export default mongoose.model("Payslip", PayslipSchema);
