import express from "express";
import {
  register,
  login,
  forgetPasswordRequest,
  verifyOTP,
  resetPassword,
  changePassword,
} from "../controllers/authController.js"; 
import authorize from "../middlewares/authorize.js";
import { ALL_STAFF_ROLES } from "../utils/roles.js";

const router = express.Router();

router.post("/register", register); 
router.post("/login", login); 
router.post("/forget-password", forgetPasswordRequest);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);
router.put(
  "/change-password/:id",
  authorize(ALL_STAFF_ROLES),
  changePassword
);

export default router;
