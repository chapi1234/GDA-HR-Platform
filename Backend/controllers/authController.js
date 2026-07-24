import bcrypt from "bcryptjs";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import jwt from "jsonwebtoken";
import getLoginMailOptions from "../Email/login.js";
import getRegisterMailOptions from "../Email/register.js";
import getPasswordResetMailOptions from "../Email/password.js";
import getPasswordChangeConfirmationMailOptions from "../Email/passwordReset.js";
import { sendEmail } from "../Email/sendEmail.js";
import { recalcDepartmentStats } from "../utils/departmentStats.js";
import {
  buildAuthTokenPayload,
  ROLES,
  sanitizeUser,
  SCOPE_LEVELS,
} from "../utils/roles.js";
import { resolveOrgPlacement } from "../utils/sectorAssign.js";

/** Public self-registration: Employee only */
export const register = async (req, res) => {
  try {
    const {
      name,
      email,
      role,
      department,
      departmentId,
      password,
      confirmPassword,
      avatar,
      leafUnitId,
      sectorId,
      subSectorId,
      subSubSectorId,
    } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ status: false, message: "All fields are required" });
    }

    // Public signup cannot create privileged roles
    if (role && role !== ROLES.EMPLOYEE) {
      return res.status(403).json({
        status: false,
        message: "Public registration is only allowed for Employee accounts",
      });
    }

    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(400).json({ status: false, message: "Employee already exist" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ status: false, message: "Passwords do not match" });
    }

    let placement = null;
    if (leafUnitId || sectorId || subSectorId || subSubSectorId) {
      placement = await resolveOrgPlacement({
        leafUnitId,
        sectorId,
        subSectorId,
        subSubSectorId,
        scopeLevel: SCOPE_LEVELS.SUB_SECTOR,
      });
      if (placement.error) {
        return res.status(400).json({ status: false, message: placement.error });
      }
    }

    // Legacy department fallback during migration
    let depDoc = null;
    if (!placement) {
      if (!department && !departmentId) {
        return res.status(400).json({
          status: false,
          message: "Sector / unit assignment is required",
        });
      }
      if (departmentId) depDoc = await Department.findById(departmentId);
      else if (department) depDoc = await Department.findOne({ name: department });
      if (!depDoc) {
        return res.status(400).json({ status: false, message: "Invalid organizational unit" });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new Employee({
      name,
      email,
      role: ROLES.EMPLOYEE,
      scopeLevel: placement?.scopeLevel || SCOPE_LEVELS.SUB_SECTOR,
      sectorId: placement?.sectorId || null,
      subSectorId: placement?.subSectorId || null,
      subSubSectorId: placement?.subSubSectorId || null,
      department: depDoc?._id,
      password: hashedPassword,
      profileImage: avatar,
    });
    await user.save();

    if (depDoc) {
      await Department.findByIdAndUpdate(depDoc._id, { $inc: { employeeCount: 1 } });
      await recalcDepartmentStats(depDoc._id);
    }

    const token = jwt.sign(buildAuthTokenPayload(user), process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    await sendEmail(getRegisterMailOptions(user.email, user.name));

    const populated = await Employee.findById(user._id)
      .populate({ path: "department", select: "name" })
      .populate({ path: "sectorId", select: "name pathNames level" })
      .populate({ path: "subSectorId", select: "name pathNames level" })
      .populate({ path: "subSubSectorId", select: "name pathNames level" });

    res.status(201).json({
      status: true,
      message: "Employee registered successfully",
      data: {
        user: sanitizeUser(populated),
        token,
      },
    });
  } catch (error) {
    console.error("register error:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({
        status: false,
        message: "Email and password are required",
      });
    }

    const user = await Employee.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({
        status: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        status: false,
        message: "Invalid credentials",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(buildAuthTokenPayload(user), process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Don't block login on email / SMTP — failures are logged only
    sendEmail(getLoginMailOptions(user.email, user.name)).catch((err) => {
      console.error("Login notification email failed:", err?.message || err);
    });

    const safeUser = await Employee.findById(user._id)
      .populate({ path: "department", select: "name" })
      .populate({ path: "sectorId", select: "name pathNames level" })
      .populate({ path: "subSectorId", select: "name pathNames level" })
      .populate({ path: "subSubSectorId", select: "name pathNames level" });

    res.status(200).json({
      status: true,
      message: "Login successful",
      data: {
        user: sanitizeUser(safeUser),
        token,
      },
    });
  } catch (error) {
    console.error("login error:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error: " + (error?.message || error),
    });
  }
};

export const forgetPasswordRequest = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({
        status: false,
        message: "Email is required",
      });
    }

    const user = await Employee.findOne({ email }).select("+otp +otpExpiry");
    if (!user) {
      return res.status(400).json({
        status: false,
        message: "User doesn't exist",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    const emailResult = await sendEmail(
      getPasswordResetMailOptions(user.email, user.name, otp)
    );

    if (!emailResult.sent) {
      return res.status(500).json({
        status: false,
        message: "Failed to send OTP email. Please try again.",
      });
    }

    res.status(200).json({
      status: true,
      message: "OTP sent to your email",
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error,
    });
  }
};

export const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  try {
    if (!email || !otp) {
      return res.status(400).json({
        status: false,
        message: "Email and OTP are required",
      });
    }

    const user = await Employee.findOne({ email }).select("+otp +otpExpiry");
    if (!user) {
      return res.status(400).json({
        status: false,
        message: "User doesn't exist",
      });
    }

    if (
      String(user.otp) !== String(otp).trim() ||
      user.otpExpiry < Date.now()
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid or expired OTP",
      });
    }

    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const resetToken = jwt.sign(
      { _id: user._id, role: user.role, purpose: "password-reset" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.status(200).json({
      status: true,
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    console.error("verifyOTP error:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

export const resetPassword = async (req, res) => {
  const { resetToken, newPassword, confirmNewPassword } = req.body;
  try {
    if (!resetToken || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        status: false,
        message: "All fields are required",
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        status: false,
        message: "New passwords do not match",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        status: false,
        message: "Invalid or expired reset token",
      });
    }

    if (decoded.purpose !== "password-reset") {
      return res.status(400).json({
        status: false,
        message: "Invalid reset token",
      });
    }

    const user = await Employee.findById(decoded._id).select("+password");
    if (!user) {
      return res.status(400).json({
        status: false,
        message: "User doesn't exist",
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await sendEmail(
      getPasswordChangeConfirmationMailOptions(user.email, user.name)
    );

    res.status(200).json({
      status: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error,
    });
  }
};

export const changePassword = async (req, res) => {
  const { id } = req.params;
  const { oldPassword, newPassword, confirmPassword } = req.body;

  try {
    if (String(req.user._id) !== String(id) && req.user.role !== ROLES.SUPERADMIN) {
      return res.status(403).json({
        status: false,
        message: "You can only change your own password",
      });
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        status: false,
        message: "All fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        status: false,
        message: "New passwords do not match",
      });
    }

    const user = await Employee.findById(id).select("+password");
    if (!user) {
      return res.status(400).json({
        status: false,
        message: "User doesn't exist",
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        status: false,
        message: "Old password is incorrect",
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await sendEmail(
      getPasswordChangeConfirmationMailOptions(user.email, user.name)
    );

    res.status(200).json({
      status: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error,
    });
  }
};
