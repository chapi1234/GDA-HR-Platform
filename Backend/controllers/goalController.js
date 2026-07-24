import Goal from "../models/Goal.js";
import Employee from "../models/Employee.js";
import mongoose from "mongoose";
import { MANAGER_AND_ABOVE } from "../utils/roles.js";
import { canAccessEmployee } from "../utils/scope.js";

const mapGoal = (g) => ({
  id: g._id,
  title: g.title,
  description: g.description,
  progress: g.progress,
  target: g.target,
  deadline: g.deadline ? new Date(g.deadline).toISOString().split("T")[0] : "",
  category: g.category,
  status: g.status,
  employee: g.employee,
});

const canManageGoals = (user) => MANAGER_AND_ABOVE.includes(user?.role);
const isOwner = (req, goal) => String(goal.employee) === String(req.user?._id);

async function canTouchGoal(req, goal) {
  if (isOwner(req, goal)) return true;
  if (!canManageGoals(req.user)) return false;
  const emp = await Employee.findById(goal.employee).select(
    "sectorId subSectorId subSubSectorId scopeLevel"
  );
  return canAccessEmployee(req.user, emp || { _id: goal.employee });
}

// GET /api/goals
export const getGoals = async (req, res) => {
  try {
    const { employeeId } = req.query;
    let filter = {};
    if (
      canManageGoals(req.user) &&
      employeeId &&
      mongoose.Types.ObjectId.isValid(employeeId)
    ) {
      const emp = await Employee.findById(employeeId).select(
        "sectorId subSectorId subSubSectorId scopeLevel"
      );
      if (!emp || !canAccessEmployee(req.user, emp)) {
        return res.status(403).json({ status: false, message: "Access denied" });
      }
      filter.employee = employeeId;
    } else {
      filter.employee = req.user._id;
    }
    const goals = await Goal.find(filter).sort({ createdAt: -1 });
    return res
      .status(200)
      .json({ status: true, message: "Goals fetched", data: goals.map(mapGoal) });
  } catch (error) {
    res
      .status(500)
      .json({ status: false, message: "Internal server error", error: error.message });
  }
};

// GET /api/goals/:id
export const getGoalById = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) return res.status(404).json({ status: false, message: "Goal not found" });
    if (!(await canTouchGoal(req, goal))) {
      return res.status(403).json({ status: false, message: "Access denied" });
    }
    return res.status(200).json({ status: true, message: "Goal fetched", data: mapGoal(goal) });
  } catch (error) {
    res
      .status(500)
      .json({ status: false, message: "Internal server error", error: error.message });
  }
};

// POST /api/goals
export const createGoal = async (req, res) => {
  try {
    const { title, description, progress, target, deadline, category, status, employee } =
      req.body;
    if (!title || !description || !deadline || !category) {
      return res.status(400).json({ status: false, message: "Missing required fields" });
    }
    let owner = req.user._id;
    if (
      canManageGoals(req.user) &&
      employee &&
      mongoose.Types.ObjectId.isValid(employee)
    ) {
      const emp = await Employee.findById(employee).select(
        "sectorId subSectorId subSubSectorId scopeLevel"
      );
      if (!emp || !canAccessEmployee(req.user, emp)) {
        return res.status(403).json({
          status: false,
          message: "Cannot create goals for users outside your scope",
        });
      }
      owner = employee;
    }
    const goal = await Goal.create({
      title,
      description,
      progress: Number(progress) || 0,
      target: Number(target) || 100,
      deadline,
      category,
      status: status || "in-progress",
      employee: owner,
    });
    return res.status(201).json({ status: true, message: "Goal created", data: mapGoal(goal) });
  } catch (error) {
    res
      .status(500)
      .json({ status: false, message: "Internal server error", error: error.message });
  }
};

// PUT /api/goals/:id
export const updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) return res.status(404).json({ status: false, message: "Goal not found" });
    if (!(await canTouchGoal(req, goal))) {
      return res.status(403).json({ status: false, message: "Access denied" });
    }

    const { title, description, progress, target, deadline, category, status } = req.body;
    if (title !== undefined) goal.title = title;
    if (description !== undefined) goal.description = description;
    if (progress !== undefined) goal.progress = Math.max(0, Math.min(100, Number(progress)));
    if (target !== undefined) goal.target = Number(target) || 100;
    if (deadline !== undefined) goal.deadline = deadline;
    if (category !== undefined) goal.category = category;
    if (status !== undefined) goal.status = status;
    await goal.save();
    return res.status(200).json({ status: true, message: "Goal updated", data: mapGoal(goal) });
  } catch (error) {
    res
      .status(500)
      .json({ status: false, message: "Internal server error", error: error.message });
  }
};

// DELETE /api/goals/:id
export const deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) return res.status(404).json({ status: false, message: "Goal not found" });
    if (!(await canTouchGoal(req, goal))) {
      return res.status(403).json({ status: false, message: "Access denied" });
    }
    await goal.deleteOne();
    return res.status(200).json({ status: true, message: "Goal deleted", data: mapGoal(goal) });
  } catch (error) {
    res
      .status(500)
      .json({ status: false, message: "Internal server error", error: error.message });
  }
};
