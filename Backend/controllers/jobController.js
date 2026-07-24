import Job from '../models/Job.js';
import Sector from '../models/Sector.js';
import Department from '../models/Department.js';

function sectorPathLabel(sector) {
  if (!sector) return '';
  if (Array.isArray(sector.pathNames) && sector.pathNames.length) {
    return sector.pathNames.join(' › ');
  }
  return sector.name || '';
}

async function resolveUnitFromBody({ sectorId, department }) {
  const id = sectorId || department;
  if (!id) return null;

  if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
    const sector = await Sector.findById(id);
    if (sector) {
      return {
        sectorId: sector._id,
        unitPath: sectorPathLabel(sector),
        department: undefined,
      };
    }
    // Legacy: still allow old department ObjectIds for updates of old jobs
    const dep = await Department.findById(id);
    if (dep) {
      return {
        sectorId: null,
        unitPath: dep.name || '',
        department: dep._id,
      };
    }
  }

  // Match by path label or name on Sector
  const asName = String(department || id || '').trim();
  if (asName) {
    const sector = await Sector.findOne({
      $or: [{ name: asName }, { pathNames: asName }],
    });
    if (sector) {
      return {
        sectorId: sector._id,
        unitPath: sectorPathLabel(sector),
        department: undefined,
      };
    }
  }

  return null;
}

function mapJob(job) {
  const obj = typeof job.toObject === 'function' ? job.toObject() : { ...job };
  const unitPath =
    obj.unitPath ||
    sectorPathLabel(obj.sectorId) ||
    (typeof obj.department === 'object' ? obj.department?.name : '') ||
    '';
  return {
    ...obj,
    id: obj._id,
    department: unitPath, // frontend still reads `department` as display label
    unitPath,
    sectorId: obj.sectorId?._id || obj.sectorId || null,
  };
}

// Create a new job (HR/admin)
export const createJob = async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'hr' && userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({ status: false, message: 'Forbidden' });
    }
    const {
      title,
      sectorId,
      department,
      description,
      requirements,
      location,
      salaryRange,
      salary,
      jobType,
      status,
      closingDate,
    } = req.body;
    if (!title || !(sectorId || department)) {
      return res.status(400).json({
        status: false,
        message: 'Title and sector / unit are required',
      });
    }

    const placement = await resolveUnitFromBody({ sectorId, department });
    if (!placement) {
      return res.status(400).json({ status: false, message: 'Invalid sector / unit' });
    }

    let parsedSalaryRange = salaryRange;
    if (!parsedSalaryRange && salary && typeof salary === 'string') {
      const nums = salary
        .replace(/[^0-9\-]/g, '')
        .split('-')
        .map((s) => s.trim())
        .filter(Boolean);
      if (nums.length === 2) {
        const min = parseInt(nums[0], 10);
        const max = parseInt(nums[1], 10);
        if (!isNaN(min) && !isNaN(max)) parsedSalaryRange = { min, max };
      }
    }

    const job = new Job({
      title,
      sectorId: placement.sectorId || null,
      unitPath: placement.unitPath || '',
      department: placement.department || undefined,
      description,
      requirements,
      location,
      salaryRange: parsedSalaryRange,
      jobType,
      status,
      closingDate,
      postedBy: req.user?._id || req.user?.id,
    });
    await job.save();
    const populated = await Job.findById(job._id)
      .populate({ path: 'sectorId', select: 'name pathNames level' })
      .populate({ path: 'department', select: 'name' });
    return res.status(201).json({ status: true, message: 'Job created', data: mapJob(populated) });
  } catch (err) {
    return res.status(500).json({ status: false, message: 'Failed to create job', error: err.message });
  }
};

// List jobs with filters and pagination
export const listJobs = async (req, res) => {
  try {
    const { search, department, location, status, page = 1, limit = 20 } = req.query;
    const q = {};
    if (search) q.title = { $regex: search, $options: 'i' };
    if (department) {
      q.$or = [
        { unitPath: { $regex: department, $options: 'i' } },
        { sectorId: department },
      ];
    }
    if (location) q.location = { $regex: location, $options: 'i' };
    if (status) q.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [rows, total] = await Promise.all([
      Job.find(q)
        .populate({ path: 'sectorId', select: 'name pathNames level' })
        .populate({ path: 'department', select: 'name' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Job.countDocuments(q),
    ]);
    return res.status(200).json({
      status: true,
      data: rows.map(mapJob),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: 'Failed to list jobs', error: err.message });
  }
};

// Get job by id
export const getJob = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id)
      .populate({ path: 'sectorId', select: 'name pathNames level' })
      .populate({ path: 'department', select: 'name' })
      .populate({ path: 'applications', select: 'name email phone applications resume createdAt' });
    if (!job) return res.status(404).json({ status: false, message: 'Job not found' });
    return res.status(200).json({ status: true, data: mapJob(job) });
  } catch (err) {
    return res.status(500).json({ status: false, message: 'Failed to get job', error: err.message });
  }
};

// Update job
export const updateJob = async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'hr' && userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({ status: false, message: 'Forbidden' });
    }
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) return res.status(404).json({ status: false, message: 'Job not found' });

    const {
      title,
      sectorId,
      department,
      description,
      requirements,
      location,
      salaryRange,
      salary,
      jobType,
      status,
      closingDate,
    } = req.body;

    if (title !== undefined) job.title = title;
    if (description !== undefined) job.description = description;
    if (requirements !== undefined) job.requirements = requirements;
    if (location !== undefined) job.location = location;
    if (jobType !== undefined) job.jobType = jobType;
    if (status !== undefined) job.status = status;
    if (closingDate !== undefined) job.closingDate = closingDate;
    if (salaryRange !== undefined) job.salaryRange = salaryRange;

    if (salary && typeof salary === 'string' && !salaryRange) {
      const nums = salary
        .replace(/[^0-9\-]/g, '')
        .split('-')
        .map((s) => s.trim())
        .filter(Boolean);
      if (nums.length === 2) {
        const min = parseInt(nums[0], 10);
        const max = parseInt(nums[1], 10);
        if (!isNaN(min) && !isNaN(max)) job.salaryRange = { min, max };
      }
    }

    if (sectorId || department) {
      const placement = await resolveUnitFromBody({ sectorId, department });
      if (!placement) {
        return res.status(400).json({ status: false, message: 'Invalid sector / unit' });
      }
      job.sectorId = placement.sectorId || null;
      job.unitPath = placement.unitPath || '';
      if (placement.department) job.department = placement.department;
      else job.department = undefined;
    }

    await job.save();
    const populated = await Job.findById(job._id)
      .populate({ path: 'sectorId', select: 'name pathNames level' })
      .populate({ path: 'department', select: 'name' });
    return res.status(200).json({ status: true, message: 'Job updated', data: mapJob(populated) });
  } catch (err) {
    return res.status(500).json({ status: false, message: 'Failed to update job', error: err.message });
  }
};

// Delete job
export const deleteJob = async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'hr' && userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({ status: false, message: 'Forbidden' });
    }
    const { id } = req.params;
    const job = await Job.findByIdAndDelete(id);
    if (!job) return res.status(404).json({ status: false, message: 'Job not found' });
    return res.status(200).json({ status: true, message: 'Job deleted' });
  } catch (err) {
    return res.status(500).json({ status: false, message: 'Failed to delete job', error: err.message });
  }
};

// Add candidate reference to job (helper)
export const addApplicationToJob = async (jobId, candidateId) => {
  try {
    await Job.findByIdAndUpdate(jobId, { $addToSet: { applications: candidateId } });
    return true;
  } catch (err) {
    console.error('Failed to add application to job', err);
    return false;
  }
};
