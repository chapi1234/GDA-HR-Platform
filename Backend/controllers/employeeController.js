import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import getRemoveEmployeeMailOptions from "../Email/removeEmployee.js";
import getAddEmployeeMailOptions from "../Email/addEmployee.js";
import bcrypt from "bcryptjs";
import { sendEmail } from "../Email/sendEmail.js";
import { recalcDepartmentStats } from "../utils/departmentStats.js";

const toId = (val) => {
  if (!val) return null;
  try { return typeof val === 'string' ? val : String(val); } catch { return null; }
};

export const getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().populate({ path: 'department', select: 'name' });
    if (!employees || employees.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No employees found",
      });
    }
    // Map to frontend shape
    const mapped = employees.map(emp => ({
      id: emp._id,
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      department: emp.department?.name || '',
      departmentId: emp.department?._id || null,
      position: emp.position,
      salary: emp.salary,
      joinDate: emp.startDate ? emp.startDate.toISOString().split('T')[0] : '',
      status: emp.status,
      avatar: emp.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=3b82f6&color=fff`,
      address: emp.address,
      employeeId: emp.employeeId || '',
      role: emp.role || 'employee',
      gender: emp.gender || '',
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.toISOString().split('T')[0] : '',
      emergencyContact: emp.emergencyContact || '',
      emergencyPhone: emp.emergencyPhone || '',
      nationalId: emp.nationalId || '',
      gradeLevel: emp.gradeLevel || '',
      education: emp.education || [],
    }));
    res.status(200).json({
      status: true,
      message: "Employees fetched successfully",
      data: mapped,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error,
    });
  }
};

export const getEmployeeById = async (req, res) => {
  const { id } = req.params;
  try {
    const emp = await Employee.findById(id).populate({ path: 'department', select: 'name' });
    if (!emp) {
      return res.status(404).json({
        status: false,
        message: "Employee not found",
      });
    }
    // Map to frontend shape
    const mapped = {
      id: emp._id,
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      department: emp.department?.name || '',
      departmentId: emp.department?._id || null,
      position: emp.position,
      salary: emp.salary,
      joinDate: emp.startDate ? emp.startDate.toISOString().split('T')[0] : '',
      status: emp.status,
      avatar: emp.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=3b82f6&color=fff`,
      address: emp.address,
      employeeId: emp.employeeId || '',
      role: emp.role || 'employee',
    };
    res.status(200).json({
      status: true,
      message: "Employee fetched successfully",
      data: mapped,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error,
    });
  }
};

export const createEmployee = async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    department, // accept name or id (legacy)
    departmentId, // preferred id
    salary,
    position,
    joinDate,
    address,
    status,
    employeeId,
    avatar,
    role,
    educationLevel,
    gradeLevel,
  } = req.body;

  try {
    if (!name || !email || !password || (!department && !departmentId)) {
      return res.status(400).json({ status: false, message: "Please fill in all required fields" });
    }

    if (await Employee.exists({ email })) {
      return res.status(400).json({ status: false, message: "Employee with this email already exists" });
    }

    // Resolve department ID
    let depDoc = null;
    if (departmentId) {
      depDoc = await Department.findById(departmentId);
    } else if (department) {
      depDoc = await Department.findOne({ name: department });
    }
    if (!depDoc) {
      return res.status(400).json({ status: false, message: "Invalid department" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new Employee({
      name,
      email,
      password: hashedPassword,
      phone,
      department: depDoc._id,
      salary,
      position,
      address,
      status: status || "active",
      employeeId,
      profileImage: avatar,
      startDate: joinDate,
      role: role || "employee",
      gradeLevel,
      ...(educationLevel ? { education: [{ degree: educationLevel }] } : {}),
    });

    await user.save();

    // Increment department employee count
  await Department.findByIdAndUpdate(depDoc._id, { $inc: { employeeCount: 1 } });
  // Recalculate average salary for department
    await recalcDepartmentStats(depDoc._id);

    const emailResult = await sendEmail(
      getAddEmployeeMailOptions(
        user.email,
        user.name,
        user.position,
        depDoc.name,
        user.salary,
        password
      )
    );

    // Map to frontend shape
    const mapped = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      department: depDoc.name,
      departmentId: depDoc._id,
      position: user.position,
      salary: user.salary,
      joinDate: user.startDate ? user.startDate.toISOString().split('T')[0] : '',
      status: user.status,
      avatar: user.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3b82f6&color=fff`,
      address: user.address,
      employeeId: user.employeeId || '',
      role: user.role || 'employee',
    };
    res.status(201).json({
      status: true,
      message: emailResult.sent
        ? "Employee created successfully. Welcome email was accepted by the mail server."
        : "Employee created successfully, but the welcome email could not be sent.",
      emailSent: emailResult.sent,
      emailNotice: emailResult.sent
        ? `Welcome email queued for ${user.email}. Ask them to check inbox and spam.`
        : emailResult.error || "Welcome email failed to send.",
      data: mapped,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error: " + error });
  }
};

export const updateEmployee = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    email,
    phone,
    dateOfBirth,
    address,
    bio,
    skills,
    emergencyContact,
    emergencyPhone,
    nationalId,
  } = req.body;
  try {
    const employee = await Employee.findByIdAndUpdate(
      id,
      {
        name,
        email,
        phone,
        dateOfBirth,
        address,
        bio,
        skills,
        emergencyContact,
        emergencyPhone,
        nationalId,
      },
      { new: true }
    );
    if (!employee) {
      return res.status(404).json({ status: false, message: "Employee not found" });
    }
    res.status(200).json({ status: true, message: "Employee updated successfully", data: employee });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error: " + error });
  }
};

export const editEmployee = async (req, res) => {
  const { name, email, phone, department, departmentId, salary, position, address, status, employeeId, avatar, joinDate, role, educationLevel, gradeLevel } = req.body;
  const { id } = req.params;
  try {
    const prev = await Employee.findById(id).populate('department');
    if (!prev) {
      return res.status(404).json({ status: false, message: "Employee not found" });
    }

    // Resolve department
    let newDeptDoc = prev.department; // default keep
    if (departmentId || department) {
      if (departmentId) newDeptDoc = await Department.findById(departmentId);
      else if (department) newDeptDoc = await Department.findOne({ name: department });
      if (!newDeptDoc) return res.status(400).json({ status: false, message: 'Invalid department' });
    }

    const oldDeptId = prev.department?._id?.toString();
    const newDeptId = newDeptDoc?._id?.toString();

    const emp = await Employee.findByIdAndUpdate(
      id,
      {
        name,
        email,
        phone,
        department: newDeptDoc?._id || prev.department,
        salary,
        position,
        address,
        status,
        employeeId,
        profileImage: avatar,
        startDate: joinDate,
        gradeLevel,
        ...(educationLevel !== undefined ? { education: [{ degree: educationLevel }] } : {}),
        ...(role ? { role } : {}),
      },
      { new: true }
    ).populate('department');

    if (!emp) {
      return res.status(404).json({ status: false, message: "Employee not found" });
    }

    // Adjust department counts if changed
    if (oldDeptId && newDeptId && oldDeptId !== newDeptId) {
      await Department.findByIdAndUpdate(oldDeptId, { $inc: { employeeCount: -1 } });
      await Department.findByIdAndUpdate(newDeptId, { $inc: { employeeCount: 1 } });
      // Recalc both departments' stats when moving
      await recalcDepartmentStats(oldDeptId);
      await recalcDepartmentStats(newDeptId);
    }
    // If salary changed but department same, still recalc current department
    if (newDeptId && oldDeptId === newDeptId && (salary !== undefined)) {
      await recalcDepartmentStats(newDeptId);
    }

    // Map to frontend shape
    const mapped = {
      id: emp._id,
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      department: emp.department?.name || '',
      departmentId: emp.department?._id || null,
      position: emp.position,
      salary: emp.salary,
      joinDate: emp.startDate ? emp.startDate.toISOString().split('T')[0] : '',
      status: emp.status,
      avatar: emp.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=3b82f6&color=fff`,
      address: emp.address,
      employeeId: emp.employeeId || '',
      role: emp.role || 'employee',
    };
    res.status(200).json({ status: true, message: "Employee updated successfully", data: mapped });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error: " + error });
  }
};

export const deleteEmployee = async (req, res) => {
  const { id } = req.params;
  try {
    const emp = await Employee.findById(id).populate('department');
    if (!emp) {
      return res.status(404).json({ status: false, message: "Employee not found" });
    }
    const emailResult = await sendEmail(
      getRemoveEmployeeMailOptions(
        emp.email,
        emp.name,
        emp.position,
        emp.department?.name || ''
      )
    );

    await Employee.findByIdAndDelete(id);

    // Decrement department employee count
    if (emp.department?._id) {
      await Department.findByIdAndUpdate(emp.department._id, { $inc: { employeeCount: -1 } });
      await recalcDepartmentStats(emp.department._id);
    }

    // Map to frontend shape
    const mapped = {
      id: emp._id,
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      department: emp.department?.name || '',
      departmentId: emp.department?._id || null,
      position: emp.position,
      salary: emp.salary,
      joinDate: emp.startDate ? emp.startDate.toISOString().split('T')[0] : '',
      status: emp.status,
      avatar: emp.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=3b82f6&color=fff`,
      address: emp.address,
      employeeId: emp.employeeId || '',
      role: emp.role || 'employee',
    };
    res.status(200).json({ status: true, message: "Employee deleted successfully", data: mapped });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error: " + error });
  }
};

export const resumeUpload = async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ status: false, message: "No file uploaded" });
  }

  try {
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ status: false, message: "Employee not found" });
    }

    // multer-storage-cloudinary already returns Cloudinary URL in file.path
    employee.resume = {
      name: req.file.originalname,
      type: req.file.mimetype,
      url: req.file.path, // Cloudinary secure URL
      uploadDate: Date.now(),
    };

    await employee.save();

    res.status(200).json({ status: true, message: "Resume uploaded successfully", data: employee.resume });
  } catch (error) {
    console.error("Resume upload error:", error);
    res.status(500).json({ status: false, message: "Internal server error", error: error.message });
  }
};

// Upload profile image and save Cloudinary URL to employee.profileImage
export const profileUpload = async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ status: false, message: "No file uploaded" });
  }

  try {
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ status: false, message: "Employee not found" });
    }

    // multer-storage-cloudinary may set different properties depending on version.
    // Try common locations for the uploaded file URL.
    const file = req.file;
    console.log('profileUpload: received file:', file && ({ originalname: file.originalname, mimetype: file.mimetype, size: file.size, path: file.path, url: file.url, secure_url: file.secure_url, location: file.location }));

    const url = file?.path || file?.secure_url || file?.url || file?.location || null;
    if (!url) {
      console.error('profileUpload: could not determine uploaded file URL', file);
      return res.status(500).json({ status: false, message: 'Uploaded but failed to determine Cloudinary URL', file });
    }

    employee.profileImage = url;
    await employee.save();

    // re-fetch to populate relations and ensure fresh data
    const saved = await Employee.findById(id).populate({ path: 'department', select: 'name' });
    console.log('profileUpload: saved profileImage=', saved.profileImage);

    // Return mapped employee (frontend expects 'avatar' in some endpoints)
    const mapped = {
      id: saved._id,
      name: saved.name,
      email: saved.email,
      phone: saved.phone,
      department: saved.department?.name || '',
      departmentId: saved.department?._id || null,
      position: saved.position,
      salary: saved.salary,
      joinDate: saved.startDate ? saved.startDate.toISOString().split('T')[0] : '',
      status: saved.status,
      avatar: saved.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(saved.name)}&background=3b82f6&color=fff`,
      address: saved.address,
      employeeId: saved.employeeId || '',
      role: saved.role || 'employee',
    };

    res.status(200).json({ status: true, message: "Profile image uploaded", data: mapped });
  } catch (error) {
    console.error("Profile upload error:", error);
    res.status(500).json({ status: false, message: "Internal server error", error: error.message });
  }
};
