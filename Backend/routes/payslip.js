import express from "express";
import authorize from "../middlewares/authorize.js";
import {
  listPayslips,
  getPayslip,
  createPayslip,
  deletePayslip,
} from "../controllers/payslipController.js";
import { ALL_STAFF_ROLES, HR_AND_ABOVE } from "../utils/roles.js";

const router = express.Router();

router.get("/", authorize(ALL_STAFF_ROLES), listPayslips);
router.get("/:id", authorize(ALL_STAFF_ROLES), getPayslip);
router.post("/", authorize(HR_AND_ABOVE), createPayslip);
router.delete("/:id", authorize(HR_AND_ABOVE), deletePayslip);

export default router;
