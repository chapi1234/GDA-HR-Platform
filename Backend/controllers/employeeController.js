import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import Sector from "../models/Sector.js";
import getRemoveEmployeeMailOptions from "../Email/removeEmployee.js";
import getAddEmployeeMailOptions from "../Email/addEmployee.js";
import bcrypt from "bcryptjs";
import { sendEmail } from "../Email/sendEmail.js";
import { recalcDepartmentStats } from "../utils/departmentStats.js";
import {
  employeeScopeFilter,
  canAccessEmployee,
  allowedRolesToCreate,
  placementWithinActorScope,
} from "../utils/scope.js";
import { resolveOrgPlacement } from "../utils/sectorAssign.js";
import { canAssignOrganizationScope, ROLES } from "../utils/roles.js";
import { logActivity } from "../utils/logActivity.js";

const toId = (val) => {
  if (!val) return null;
  try { return typeof val === 'string' ? val : String(val); } catch { return null; }
};

/** Keep only entries that have a company name */
function sanitizeWorkHistory(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((w) => ({
      company: String(w?.company || "").trim(),
      position: String(w?.position || "").trim(),
      startDate: String(w?.startDate || "").trim(),
      endDate: String(w?.endDate || "").trim(),
      description: String(w?.description || "").trim(),
    }))
    .filter((w) => w.company);
}

function toDateOnly(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function mapEmployee(emp) {
  const unitPath =
    emp.subSubSectorId?.pathNames?.join(" › ") ||
    emp.subSectorId?.pathNames?.join(" › ") ||
    emp.sectorId?.pathNames?.join(" › ") ||
    emp.department?.name ||
    "";

  // Prefer explicit join date (startDate); otherwise use account creation day
  const joinDate = toDateOnly(emp.startDate) || toDateOnly(emp.createdAt);

  return {
    id: emp._id,
    name: emp.name,
    email: emp.email,
    phone: emp.phone,
    department: emp.department?.name || unitPath,
    departmentId: emp.department?._id || null,
    sectorId: emp.sectorId?._id || emp.sectorId || null,
    subSectorId: emp.subSectorId?._id || emp.subSectorId || null,
    subSubSectorId: emp.subSubSectorId?._id || emp.subSubSectorId || null,
    scopeLevel: emp.scopeLevel,
    unitPath,
    position: emp.position,
    salary: emp.salary,
    bankName: emp.bankName || "",
    bankAccountName: emp.bankAccountName || "",
    bankAccountNumber: emp.bankAccountNumber || "",
    bankBranch: emp.bankBranch || "",
    joinDate,
    createdAt: toDateOnly(emp.createdAt),
    status: emp.status,
    avatar:
      emp.profileImage ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=3b82f6&color=fff`,
    profileImage: emp.profileImage || "",
    address: emp.address,
    employeeId: emp.employeeId || "",
    role: emp.role || "employee",
    gender: emp.gender || "",
    dateOfBirth: toDateOnly(emp.dateOfBirth),
    emergencyContact: emp.emergencyContact || "",
    emergencyPhone: emp.emergencyPhone || "",
    nationalId: emp.nationalId || "",
    gradeLevel: emp.gradeLevel || "",
    education: emp.education || [],
    workHistory: Array.isArray(emp.workHistory)
      ? emp.workHistory.map((w) => ({
          company: w.company || "",
          position: w.position || "",
          startDate: w.startDate || "",
          endDate: w.endDate || "",
          description: w.description || "",
        }))
      : [],
    bio: emp.bio || "",
    skills: emp.skills || "",
    payType: emp.payType || "salary",
    endDate: toDateOnly(emp.endDate),
  };
}

export const getAllEmployees = async (req, res) => {
  try {
    // Prefer DB user for scope — JWT can be stale/incomplete after role changes
    const actorId = req.user?._id || req.user?.id;
    let actor = req.user;
    if (actorId) {
      const dbUser = await Employee.findById(actorId)
        .select("role scopeLevel sectorId subSectorId subSubSectorId")
        .lean();
      if (dbUser) {
        actor = {
          ...req.user,
          ...dbUser,
          _id: dbUser._id,
          role: dbUser.role,
          scopeLevel: dbUser.scopeLevel,
        };
      }
    }

    const scopeFilter = employeeScopeFilter(actor);
    const employees = await Employee.find(scopeFilter)
      .populate({ path: "department", select: "name" })
      .populate({ path: "sectorId", select: "name pathNames level" })
      .populate({ path: "subSectorId", select: "name pathNames level" })
      .populate({ path: "subSubSectorId", select: "name pathNames level" })
      .sort({ name: 1 });

    res.status(200).json({
      status: true,
      message: "Employees fetched successfully",
      data: (employees || []).map(mapEmployee),
    });
  } catch (error) {
    console.error("getAllEmployees error:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error: " + (error?.message || error),
    });
  }
};

export const getEmployeeById = async (req, res) => {
  const { id } = req.params;
  try {
    // Prefer DB user for scope — JWT can be stale/incomplete after role changes
    const actorId = req.user?._id || req.user?.id;
    let actor = req.user;
    if (actorId) {
      const dbUser = await Employee.findById(actorId)
        .select("role scopeLevel sectorId subSectorId subSubSectorId")
        .lean();
      if (dbUser) {
        actor = {
          ...req.user,
          ...dbUser,
          _id: dbUser._id,
          role: dbUser.role,
          scopeLevel: dbUser.scopeLevel,
        };
      }
    }

    // Same visibility rules as the employees list
    const scopeFilter = employeeScopeFilter(actor);
    const emp = await Employee.findOne({ _id: id, ...scopeFilter })
      .populate({ path: "department", select: "name" })
      .populate({ path: "sectorId", select: "name pathNames level" })
      .populate({ path: "subSectorId", select: "name pathNames level" })
      .populate({ path: "subSubSectorId", select: "name pathNames level" });

    if (!emp) {
      const exists = await Employee.exists({ _id: id });
      if (!exists) {
        return res.status(404).json({
          status: false,
          message: "Employee not found",
        });
      }
      return res.status(403).json({ status: false, message: "Access denied" });
    }

    res.status(200).json({
      status: true,
      message: "Employee fetched successfully",
      data: mapEmployee(emp),
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
    department,
    departmentId,
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
    leafUnitId,
    sectorId,
    subSectorId,
    subSubSectorId,
    scopeLevel,
    bankName,
    bankAccountName,
    bankAccountNumber,
    workHistory,
  } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ status: false, message: "Please fill in all required fields" });
    }

    const requestedRole = role || ROLES.EMPLOYEE;
    const allowed = allowedRolesToCreate(req.user);
    if (!allowed.includes(requestedRole)) {
      return res.status(403).json({
        status: false,
        message: `You cannot create users with role '${requestedRole}'`,
      });
    }

    if (await Employee.exists({ email })) {
      return res.status(400).json({ status: false, message: "Employee with this email already exists" });
    }

    let placement = null;
    if (leafUnitId || sectorId || subSectorId || subSubSectorId) {
      placement = await resolveOrgPlacement({
        leafUnitId,
        sectorId,
        subSectorId,
        subSubSectorId,
        scopeLevel,
      });
      if (placement.error) {
        return res.status(400).json({ status: false, message: placement.error });
      }
    }

    // Admin / HR / Super Admin are always organization-wide
    // Sector Lead is always sector-scoped and needs a sector placement
    const isOrgRole =
      requestedRole === ROLES.SUPERADMIN ||
      requestedRole === ROLES.ADMIN ||
      requestedRole === ROLES.HR ||
      scopeLevel === "organization";

    if (requestedRole === ROLES.SECTOR_LEAD) {
      if (!placement?.sectorId) {
        return res.status(400).json({
          status: false,
          message: "Sector Lead must be assigned to a top-level sector",
        });
      }
    }

    if (requestedRole === ROLES.MANAGER) {
      if (!placement?.subSectorId) {
        return res.status(400).json({
          status: false,
          message: "Manager must be assigned to a sub-sector",
        });
      }
      if (placement.subSubSectorId) {
        return res.status(400).json({
          status: false,
          message:
            "Manager is for a sub-sector. Use Unit Manager for a sub-sub-sector",
        });
      }
    }

    if (requestedRole === ROLES.UNIT_MANAGER) {
      if (!placement?.subSubSectorId) {
        return res.status(400).json({
          status: false,
          message: "Unit Manager must be assigned to a sub-sub-sector",
        });
      }
    }

    if (isOrgRole && !canAssignOrganizationScope(req.user)) {
      return res.status(403).json({
        status: false,
        message: "Only organization-wide Admin/HR or Super Admin can create org-wide accounts",
      });
    }

    if (
      !placementWithinActorScope(req.user, {
        placement: placement || null,
        isOrgRole,
      })
    ) {
      return res.status(403).json({
        status: false,
        message: "You can only create users within your organizational unit",
      });
    }

    let depDoc = null;
    if (!placement && !isOrgRole) {
      if (departmentId || department) {
        if (departmentId) depDoc = await Department.findById(departmentId);
        else depDoc = await Department.findOne({ name: department });
        if (!depDoc) {
          return res.status(400).json({ status: false, message: "Invalid organizational unit" });
        }
      } else {
        return res.status(400).json({
          status: false,
          message: "Sector / sub-sector assignment is required for this role",
        });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new Employee({
      name,
      email,
      password: hashedPassword,
      phone,
      department: depDoc?._id,
      sectorId: isOrgRole ? null : placement?.sectorId || null,
      subSectorId: isOrgRole ? null : placement?.subSectorId || null,
      subSubSectorId: isOrgRole ? null : placement?.subSubSectorId || null,
      scopeLevel: isOrgRole
        ? "organization"
        : requestedRole === ROLES.SECTOR_LEAD
          ? "sector"
          : requestedRole === ROLES.MANAGER
            ? "sub_sector"
            : requestedRole === ROLES.UNIT_MANAGER
              ? "sub_sub_sector"
              : placement?.scopeLevel || scopeLevel || "sub_sector",
      salary,
      position,
      address,
      status: status || "active",
      employeeId,
      profileImage: avatar,
      startDate: joinDate ? new Date(joinDate) : new Date(),
      role: requestedRole,
      // Sector Lead sits on the sector root (not a sub-unit)
      ...(requestedRole === ROLES.SECTOR_LEAD
        ? {
            sectorId: placement.sectorId,
            subSectorId: null,
            subSubSectorId: null,
          }
        : {}),
      ...(requestedRole === ROLES.MANAGER
        ? {
            sectorId: placement.sectorId,
            subSectorId: placement.subSectorId,
            subSubSectorId: null,
          }
        : {}),
      ...(requestedRole === ROLES.UNIT_MANAGER
        ? {
            sectorId: placement.sectorId,
            subSectorId: placement.subSectorId,
            subSubSectorId: placement.subSubSectorId,
          }
        : {}),
      gradeLevel,
      bankName: bankName || "Commercial Bank of Ethiopia",
      bankAccountName: bankAccountName || name || "",
      bankAccountNumber: bankAccountNumber || "",
      ...(educationLevel ? { education: [{ degree: educationLevel }] } : {}),
      workHistory: sanitizeWorkHistory(workHistory),
    });

    await user.save();

    if (depDoc) {
      await Department.findByIdAndUpdate(depDoc._id, { $inc: { employeeCount: 1 } });
      await recalcDepartmentStats(depDoc._id);
    }
    if (placement?.unit) {
      await Sector.findByIdAndUpdate(placement.unit._id, { $inc: { employeeCount: 1 } });
    }

    const unitLabel = placement?.pathLabel || depDoc?.name || "Organization";

    const emailResult = await sendEmail(
      getAddEmployeeMailOptions(
        user.email,
        user.name,
        user.position,
        unitLabel,
        user.salary,
        password
      )
    );

    const populated = await Employee.findById(user._id)
      .populate({ path: "department", select: "name" })
      .populate({ path: "sectorId", select: "name pathNames level" })
      .populate({ path: "subSectorId", select: "name pathNames level" })
      .populate({ path: "subSubSectorId", select: "name pathNames level" });

    logActivity({
      actor: user._id,
      action: "Employee added",
      type: "employee",
      meta: {
        employeeId: user.employeeId || "",
        employeeName: user.name,
        role: user.role,
        sectorId: user.sectorId ? String(user.sectorId) : "",
        subSectorId: user.subSectorId ? String(user.subSectorId) : "",
        subSubSectorId: user.subSubSectorId ? String(user.subSubSectorId) : "",
        addedBy: String(req.user?._id || req.user?.id || ""),
        addedByName: req.user?.name || "",
      },
    });

    res.status(201).json({
      status: true,
      message: emailResult.sent
        ? "User created successfully. Welcome email was accepted by the mail server."
        : "User created successfully, but the welcome email could not be sent.",
      emailSent: emailResult.sent,
      emailNotice: emailResult.sent
        ? `Welcome email queued for ${user.email}. Ask them to check inbox and spam.`
        : emailResult.error || "Welcome email failed to send.",
      data: mapEmployee(populated),
    });
  } catch (error) {
    console.error("createEmployee error:", error);
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
    bankName,
    bankAccountName,
    bankAccountNumber,
    workHistory,
  } = req.body;
  try {
    // Employees may only update their own profile via this route
    const actorId = String(req.user?._id || req.user?.id || "");
    if (actorId && String(id) !== actorId) {
      const role = req.user?.role;
      const canEditOthers =
        role === "superadmin" || role === "admin" || role === "hr";
      if (!canEditOthers) {
        return res.status(403).json({
          status: false,
          message: "You can only update your own profile",
        });
      }
    }

    // Empty string / null breaks unique sparse indexes (nationalId) — unset instead
    const nationalIdProvided = nationalId !== undefined;
    const cleanNationalId = nationalIdProvided
      ? String(nationalId || "").trim()
      : undefined;
    const cleanDob =
      dateOfBirth === undefined
        ? undefined
        : String(dateOfBirth || "").trim() || null;

    const update = {
      name,
      email,
      phone,
      ...(cleanDob !== undefined ? { dateOfBirth: cleanDob } : {}),
      address,
      bio,
      skills,
      emergencyContact,
      emergencyPhone,
      ...(cleanNationalId
        ? { nationalId: cleanNationalId }
        : {}),
      ...(bankName !== undefined
        ? { bankName: bankName || "Commercial Bank of Ethiopia" }
        : {}),
      ...(bankAccountName !== undefined ? { bankAccountName } : {}),
      ...(bankAccountNumber !== undefined ? { bankAccountNumber } : {}),
      ...(workHistory !== undefined
        ? { workHistory: sanitizeWorkHistory(workHistory) }
        : {}),
    };

    // Drop undefined so $set does not wipe unrelated fields
    Object.keys(update).forEach((key) => {
      if (update[key] === undefined) delete update[key];
    });

    const unset =
      nationalIdProvided && !cleanNationalId ? { nationalId: 1 } : undefined;

    const employee = await Employee.findByIdAndUpdate(
      id,
      {
        $set: update,
        ...(unset ? { $unset: unset } : {}),
      },
      { new: true }
    );
    if (!employee) {
      return res.status(404).json({ status: false, message: "Employee not found" });
    }
    res.status(200).json({
      status: true,
      message: "Employee updated successfully",
      data: mapEmployee(employee),
    });
  } catch (error) {
    console.error("updateEmployee error:", error);
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field";
      return res.status(400).json({
        status: false,
        message: `Duplicate value for ${field}. Please use a unique value.`,
      });
    }
    res.status(500).json({ status: false, message: "Internal server error: " + error });
  }
};

export const editEmployee = async (req, res) => {
  const {
    name,
    email,
    phone,
    department,
    departmentId,
    salary,
    position,
    address,
    status,
    employeeId,
    avatar,
    joinDate,
    role,
    educationLevel,
    gradeLevel,
    leafUnitId,
    sectorId,
    subSectorId,
    subSubSectorId,
    scopeLevel,
    bankName,
    bankAccountName,
    bankAccountNumber,
    bankBranch,
    workHistory,
  } = req.body;
  const { id } = req.params;
  try {
    const prev = await Employee.findById(id).populate("department");
    if (!prev) {
      return res.status(404).json({ status: false, message: "Employee not found" });
    }

    if (!canAccessEmployee(req.user, prev)) {
      return res.status(403).json({ status: false, message: "Access denied" });
    }

    if (role && role !== prev.role) {
      const allowed = allowedRolesToCreate(req.user);
      if (!allowed.includes(role)) {
        return res.status(403).json({
          status: false,
          message: `You cannot assign role '${role}'`,
        });
      }
    }

    let placement = null;
    if (leafUnitId || sectorId || subSectorId || subSubSectorId) {
      placement = await resolveOrgPlacement({
        leafUnitId,
        sectorId,
        subSectorId,
        subSubSectorId,
        scopeLevel,
      });
      if (placement.error) {
        return res.status(400).json({ status: false, message: placement.error });
      }
    }

    const nextRole = role || prev.role;
    const isOrgRole =
      nextRole === ROLES.SUPERADMIN ||
      nextRole === ROLES.ADMIN ||
      nextRole === ROLES.HR ||
      scopeLevel === "organization";

    if (nextRole === ROLES.SECTOR_LEAD && isOrgRole) {
      return res.status(400).json({
        status: false,
        message: "Sector Lead cannot be organization-wide",
      });
    }
    if (
      nextRole === ROLES.SECTOR_LEAD &&
      placement &&
      !placement.sectorId
    ) {
      return res.status(400).json({
        status: false,
        message: "Sector Lead must be assigned to a top-level sector",
      });
    }

    if (nextRole === ROLES.MANAGER && placement) {
      if (!placement.subSectorId) {
        return res.status(400).json({
          status: false,
          message: "Manager must be assigned to a sub-sector",
        });
      }
      if (placement.subSubSectorId) {
        return res.status(400).json({
          status: false,
          message:
            "Manager is for a sub-sector. Use Unit Manager for a sub-sub-sector",
        });
      }
    }

    if (nextRole === ROLES.UNIT_MANAGER && placement && !placement.subSubSectorId) {
      return res.status(400).json({
        status: false,
        message: "Unit Manager must be assigned to a sub-sub-sector",
      });
    }

    if (isOrgRole && !canAssignOrganizationScope(req.user)) {
      return res.status(403).json({
        status: false,
        message: "Only organization-wide Admin/HR or Super Admin can assign org-wide scope",
      });
    }
    if (
      (placement || isOrgRole) &&
      !placementWithinActorScope(req.user, {
        placement: placement || null,
        isOrgRole,
      })
    ) {
      return res.status(403).json({
        status: false,
        message: "You can only assign users within your organizational unit",
      });
    }

    // Legacy department support
    let newDeptDoc = prev.department;
    if (!placement && !isOrgRole && (departmentId || department)) {
      if (departmentId) newDeptDoc = await Department.findById(departmentId);
      else if (department) newDeptDoc = await Department.findOne({ name: department });
      if (!newDeptDoc) {
        return res.status(400).json({ status: false, message: "Invalid organizational unit" });
      }
    }

    const oldDeptId = prev.department?._id?.toString();
    const newDeptId = newDeptDoc?._id?.toString();

    const emp = await Employee.findByIdAndUpdate(
      id,
      {
        name,
        email,
        phone,
        department: isOrgRole || placement ? prev.department : newDeptDoc?._id || prev.department,
        salary,
        position,
        address,
        status,
        employeeId,
        profileImage: avatar,
        ...(joinDate ? { startDate: new Date(joinDate) } : {}),
        gradeLevel,
        ...(bankName !== undefined ? { bankName } : {}),
        ...(bankAccountName !== undefined ? { bankAccountName } : {}),
        ...(bankAccountNumber !== undefined ? { bankAccountNumber } : {}),
        ...(bankBranch !== undefined ? { bankBranch } : {}),
        ...(educationLevel !== undefined ? { education: [{ degree: educationLevel }] } : {}),
        ...(workHistory !== undefined
          ? { workHistory: sanitizeWorkHistory(workHistory) }
          : {}),
        ...(role ? { role } : {}),
        ...(isOrgRole
          ? {
              scopeLevel: "organization",
              sectorId: null,
              subSectorId: null,
              subSubSectorId: null,
            }
          : {}),
        ...(placement && nextRole === ROLES.SECTOR_LEAD
          ? {
              sectorId: placement.sectorId,
              subSectorId: null,
              subSubSectorId: null,
              scopeLevel: "sector",
            }
          : {}),
        ...(placement && nextRole === ROLES.MANAGER
          ? {
              sectorId: placement.sectorId,
              subSectorId: placement.subSectorId,
              subSubSectorId: null,
              scopeLevel: "sub_sector",
            }
          : {}),
        ...(placement && nextRole === ROLES.UNIT_MANAGER
          ? {
              sectorId: placement.sectorId,
              subSectorId: placement.subSectorId,
              subSubSectorId: placement.subSubSectorId,
              scopeLevel: "sub_sub_sector",
            }
          : {}),
        ...(placement &&
        nextRole !== ROLES.SECTOR_LEAD &&
        nextRole !== ROLES.MANAGER &&
        nextRole !== ROLES.UNIT_MANAGER &&
        !isOrgRole
          ? {
              sectorId: placement.sectorId,
              subSectorId: placement.subSectorId,
              subSubSectorId: placement.subSubSectorId,
              scopeLevel: placement.scopeLevel,
            }
          : {}),
      },
      { new: true }
    )
      .populate("department")
      .populate({ path: "sectorId", select: "name pathNames level" })
      .populate({ path: "subSectorId", select: "name pathNames level" })
      .populate({ path: "subSubSectorId", select: "name pathNames level" });

    if (!emp) {
      return res.status(404).json({ status: false, message: "Employee not found" });
    }

    if (oldDeptId && newDeptId && oldDeptId !== newDeptId) {
      await Department.findByIdAndUpdate(oldDeptId, { $inc: { employeeCount: -1 } });
      await Department.findByIdAndUpdate(newDeptId, { $inc: { employeeCount: 1 } });
      await recalcDepartmentStats(oldDeptId);
      await recalcDepartmentStats(newDeptId);
    }
    if (newDeptId && oldDeptId === newDeptId && salary !== undefined) {
      await recalcDepartmentStats(newDeptId);
    }

    const prevStatus = String(prev.status || "active").toLowerCase();
    const nextStatus = String(emp.status || "active").toLowerCase();
    if (prevStatus !== nextStatus) {
      if (nextStatus === "inactive" || nextStatus === "terminated") {
        logActivity({
          actor: emp._id,
          action:
            nextStatus === "terminated"
              ? "Employee terminated"
              : "Employee deactivated",
          type: "employee",
          meta: {
            employeeId: emp.employeeId || "",
            employeeName: emp.name,
            status: nextStatus,
            sectorId: emp.sectorId ? String(emp.sectorId._id || emp.sectorId) : "",
            subSectorId: emp.subSectorId
              ? String(emp.subSectorId._id || emp.subSectorId)
              : "",
            subSubSectorId: emp.subSubSectorId
              ? String(emp.subSubSectorId._id || emp.subSubSectorId)
              : "",
            updatedBy: String(req.user?._id || req.user?.id || ""),
            updatedByName: req.user?.name || "",
          },
        });
      } else if (nextStatus === "active") {
        logActivity({
          actor: emp._id,
          action: "Employee reactivated",
          type: "employee",
          meta: {
            employeeId: emp.employeeId || "",
            employeeName: emp.name,
            status: nextStatus,
            sectorId: emp.sectorId ? String(emp.sectorId._id || emp.sectorId) : "",
            subSectorId: emp.subSectorId
              ? String(emp.subSectorId._id || emp.subSectorId)
              : "",
            subSubSectorId: emp.subSubSectorId
              ? String(emp.subSubSectorId._id || emp.subSubSectorId)
              : "",
            updatedBy: String(req.user?._id || req.user?.id || ""),
            updatedByName: req.user?.name || "",
          },
        });
      }
    }

    res.status(200).json({
      status: true,
      message: "Employee updated successfully",
      data: mapEmployee(emp),
    });
  } catch (error) {
    res.status(500).json({ status: false, message: "Internal server error: " + error });
  }
};

export const deleteEmployee = async (req, res) => {
  const { id } = req.params;
  try {
    const emp = await Employee.findById(id)
      .populate("department")
      .populate({ path: "sectorId", select: "name pathNames" })
      .populate({ path: "subSectorId", select: "name pathNames" })
      .populate({ path: "subSubSectorId", select: "name pathNames" });
    if (!emp) {
      return res.status(404).json({ status: false, message: "Employee not found" });
    }
    const unitLabel =
      emp.subSubSectorId?.pathNames?.join(" › ") ||
      emp.subSectorId?.pathNames?.join(" › ") ||
      emp.sectorId?.pathNames?.join(" › ") ||
      emp.department?.name ||
      "";
    const emailResult = await sendEmail(
      getRemoveEmployeeMailOptions(
        emp.email,
        emp.name,
        emp.position,
        unitLabel
      )
    );

    await Employee.findByIdAndDelete(id);

    logActivity({
      actor: req.user?._id || req.user?.id,
      action: `Employee removed: ${emp.name}`,
      type: "employee",
      meta: {
        employeeId: emp.employeeId || "",
        employeeName: emp.name,
        removedId: String(emp._id),
        sectorId: emp.sectorId?._id
          ? String(emp.sectorId._id)
          : emp.sectorId
            ? String(emp.sectorId)
            : "",
        subSectorId: emp.subSectorId?._id
          ? String(emp.subSectorId._id)
          : emp.subSectorId
            ? String(emp.subSectorId)
            : "",
        subSubSectorId: emp.subSubSectorId?._id
          ? String(emp.subSubSectorId._id)
          : emp.subSubSectorId
            ? String(emp.subSubSectorId)
            : "",
        removedBy: String(req.user?._id || req.user?.id || ""),
        removedByName: req.user?.name || "",
      },
    });

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
      profileImage: saved.profileImage || "",
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
