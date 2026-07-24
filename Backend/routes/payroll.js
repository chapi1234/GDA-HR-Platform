import express from "express";
import authorize from "../middlewares/authorize.js";
import {
  createPayroll,
  getPayrolls,
  updatePayroll,
  deletePayroll,
  approvePayroll,
  rejectPayroll,
} from "../controllers/payrollController.js";
import {
  markPayrollPaid,
  bulkApprovePayroll,
  bulkRejectPayroll,
  batchCreatePayroll,
  lockPayrollMonth,
  unlockPayrollMonth,
  getMonthLockStatus,
  exportBankTransfer,
  sendMonthEndReminders,
  previewUnpaidLeave,
} from "../controllers/payrollOpsController.js";
import { ALL_STAFF_ROLES, ROLES } from "../utils/roles.js";

const router = express.Router();

const PAYROLL_CREATORS = [ROLES.MANAGER, ROLES.HR];
const PAYROLL_MUTATORS = [ROLES.MANAGER, ROLES.HR];

router.post("/", authorize(PAYROLL_CREATORS), createPayroll);
router.post("/batch", authorize(PAYROLL_CREATORS), batchCreatePayroll);
router.post("/bulk-approve", authorize([ROLES.HR]), bulkApprovePayroll);
router.post("/bulk-reject", authorize([ROLES.HR]), bulkRejectPayroll);
router.post("/lock-month", authorize([ROLES.HR, ROLES.SUPERADMIN]), lockPayrollMonth);
router.post("/unlock-month", authorize([ROLES.HR, ROLES.SUPERADMIN]), unlockPayrollMonth);
router.post("/reminders", authorize([ROLES.HR, ROLES.SUPERADMIN]), sendMonthEndReminders);
router.get("/month-lock", authorize(ALL_STAFF_ROLES), getMonthLockStatus);
router.get("/bank-export", authorize(ALL_STAFF_ROLES), exportBankTransfer);
router.get("/unpaid-leave-preview", authorize(PAYROLL_CREATORS), previewUnpaidLeave);
router.get("/", authorize(ALL_STAFF_ROLES), getPayrolls);
router.patch("/:id/paid", authorize([ROLES.HR, ROLES.SUPERADMIN]), markPayrollPaid);
router.patch("/:id", authorize(PAYROLL_MUTATORS), updatePayroll);
router.delete("/:id", authorize(PAYROLL_MUTATORS), deletePayroll);
router.patch("/:id/approve", authorize([ROLES.HR]), approvePayroll);
router.patch("/:id/reject", authorize([ROLES.HR]), rejectPayroll);

export default router;
