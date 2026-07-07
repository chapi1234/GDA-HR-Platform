import bcrypt from "bcryptjs";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import getLoginMailOptions from "../Email/login.js";
import getRegisterMailOptions from "../Email/register.js";
import getPasswordResetMailOptions from "../Email/password.js";
import getPasswordChangeConfirmationMailOptions from "../Email/passwordReset.js";
import { sendEmail } from "../Email/sendEmail.js";
import { recalcDepartmentStats } from "../utils/departmentStats.js";

export const register = async (req, res) => {
  try {
    const { name, email, role, department, departmentId, password, confirmPassword, avatar } = req.body;

    if (!name || !email || !role || !password || !confirmPassword || (!department && !departmentId)) {
      return res.status(400).json({ status: false, message: "All fields are required" });
    }

    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(400).json({ status: false, message: "Employee already exist" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ status: false, message: "Passwords do not match" });
    }

    // Resolve department document
    let depDoc = null;
    if (departmentId) depDoc = await Department.findById(departmentId);
    else if (department) depDoc = await Department.findOne({ name: department });
    if (!depDoc) {
      return res.status(400).json({ status: false, message: "Invalid department" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new Employee({
      name,
      email,
      role,
      department: depDoc._id,
      password: hashedPassword,
      profileImage: avatar,
    });
    await user.save();

    // Increment department count
  await Department.findByIdAndUpdate(depDoc._id, { $inc: { employeeCount: 1 } });
  // Recalculate stats (avg salary may remain zero if no salary set yet)
  await recalcDepartmentStats(depDoc._id);

    const token = jwt.sign(
      { _id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    await sendEmail(getRegisterMailOptions(user.email, user.name));

    // Return populated user for client convenience
    const populated = await Employee.findById(user._id).populate({ path: 'department', select: 'name' });

    res.status(201).json({
      status: true,
      message: "Employee registered successfully",
      data: {
        user: populated,
        token,
      },
    });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  const { email, password, role } = req.body;
  try {
    if (!email || !password || !role) {
      return res.status(400).json({
        status: false,
        message: "All fields are required",
      });
    }

    const user = await Employee.findOne({ email });
    if (!user) {
      return res.status(400).json({
        status: false,
        message: "User doesn't exist",
      });
    }

    // Check if role matches
    if (user.role !== role) {
      return res.status(403).json({
        status: false,
        message: `Role mismatch. You are registered as '${user.role}'.`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        status: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { _id: user._id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    await sendEmail(getLoginMailOptions(user.email, user.name));

    res.status(200).json({
      status: true,
      message: "Login successful",
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error" + error,
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

    const user = await Employee.findOne({ email });
    if (!user) {
      return res.status(400).json({
        status: false,
        message: "User doesn't exist",
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP and expiry (10 minutes)
    user.otp = otp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    const emailResult = await sendEmail(
      getPasswordResetMailOptions(user.email, user.name, user.otp)
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

    const user = await Employee.findOne({ email });
    if (!user) {
      return res.status(400).json({
        status: false,
        message: "User doesn't exist",
      });
    }

    console.log("DB OTP:", user.otp, "Received OTP:", otp);

    // safer: cast to string and trim
    if (
      String(user.otp) !== String(otp).trim() ||
      user.otpExpiry < Date.now()
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid or expired OTP",
      });
    }

    // Clear OTP after successful verification
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Generate a secure reset token (valid for 15 minutes)
    const resetToken = jwt.sign(
      { _id: user._id, role: user.role },
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

    // Verify the reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        status: false,
        message: "Invalid or expired reset token",
      });
    }

    const user = await Employee.findById(decoded._id);
    if (!user) {
      return res.status(400).json({
        status: false,
        message: "User doesn't exist",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
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

    const user = await Employee.findById(id);
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
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
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
