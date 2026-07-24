import Candidate from '../models/Candidate.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { addApplicationToJob } from './jobController.js';
import Job from '../models/Job.js';

// Update application status (HR/Admin)
export const updateApplicationStatus = async (req, res) => {
  try {
    const appId = req.params.id;
    const { status } = req.body;
    if (!appId) return res.status(400).json({ status: false, message: 'application id is required' });
    if (!status) return res.status(400).json({ status: false, message: 'status is required' });

    // find the candidate that has this application
    // find the candidate that has this application (by candidate.application._id)
    let cand = await Candidate.findOne({ 'applications._id': appId });
    if (cand) {
      // update the subdocument
      const app = cand.applications.id(appId);
      if (!app) return res.status(404).json({ status: false, message: 'Application not found on candidate' });
      app.status = status;
      await cand.save();
    } else {
      // Fallback: maybe the provided id is the Job.applicationsDetails subdocument id.
      // Try to find the job detail and map it to the candidate's application by job id.
      const job = await Job.findOne({ 'applicationsDetails._id': appId }).lean();
      if (!job) return res.status(404).json({ status: false, message: 'Application not found' });

      // locate the details entry
      const detail = (job.applicationsDetails || []).find(d => String(d._id) === String(appId));
      const candidateId = detail?.candidate;
      if (!candidateId) return res.status(404).json({ status: false, message: 'Associated candidate not found for application' });

      cand = await Candidate.findById(candidateId);
      if (!cand) return res.status(404).json({ status: false, message: 'Candidate not found' });

      // try to find the candidate's application for this job. Prefer matching appliedAt when available.
      let app = null;
      if (detail?.appliedAt) {
        app = cand.applications.find(a => String(a.job) === String(job._id) && String(new Date(a.appliedAt)) === String(new Date(detail.appliedAt)));
      }
      if (!app) {
        // fallback: find by job id
        app = cand.applications.find(a => String(a.job) === String(job._id));
      }
      if (!app) return res.status(404).json({ status: false, message: 'Application not found on candidate' });
      app.status = status;
      await cand.save();
    }

    // also update the job's applicationsDetails if present
    try {
      await Job.updateOne(
        { 'applicationsDetails._id': appId },
        { $set: { 'applicationsDetails.$.status': status } }
      );
    } catch (e) {
      // log but don't fail the whole request
      console.error('Failed to update job application status:', e.message || e);
    }

    return res.status(200).json({ status: true, message: 'Application status updated' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: 'Failed to update application status', error: err.message });
  }
};

// Register candidate
export const registerCandidate = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ status: false, message: 'All fields are required' });
    const existing = await Candidate.findOne({ email });
    if (existing) return res.status(400).json({ status: false, message: 'Candidate already exists' });
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    const cand = new Candidate({ name, email, password: hashed });
    await cand.save();
    const token = jwt.sign({ _id: cand._id, role: 'candidate' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ status: true, message: 'Registered', data: { user: cand, token } });
  } catch (err) {
    return res.status(500).json({ status: false, message: 'Failed to register', error: err.message });
  }
};

// Login candidate
export const loginCandidate = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ status: false, message: 'All fields are required' });
    const cand = await Candidate.findOne({ email });
    if (!cand) return res.status(400).json({ status: false, message: 'Candidate not found' });
    const isMatch = await bcrypt.compare(password, cand.password || '');
    if (!isMatch) return res.status(400).json({ status: false, message: 'Invalid credentials' });
    const token = jwt.sign({ _id: cand._id, role: 'candidate' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({ status: true, message: 'Login successful', data: { user: cand, token } });
  } catch (err) {
    return res.status(500).json({ status: false, message: 'Failed to login', error: err.message });
  }
};

// Get my profile
export const getMe = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    // populate the job title for each application so frontend can display it without extra requests
    const cand = await Candidate.findById(userId).populate({ path: 'applications.job', select: 'title' });
    if (!cand) return res.status(404).json({ status: false, message: 'Candidate not found' });
    return res.status(200).json({ status: true, data: cand });
  } catch (err) {
    return res.status(500).json({ status: false, message: 'Failed to fetch profile', error: err.message });
  }
};

// List candidates (HR/admin)
export const listCandidates = async (req, res) => {
  try {
    if (!['hr', 'admin', 'superadmin'].includes(req.user?.role)) {
      return res.status(403).json({ status: false, message: 'Forbidden' });
    }
    const { search, status } = req.query;
    const q = {};
    if (search) q.name = { $regex: search, $options: 'i' };
    // status could be application-level; keep simple and return all candidates
    const data = await Candidate.find(q).sort({ createdAt: -1 });
    return res.status(200).json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: 'Failed to list candidates', error: err.message });
  }
};

// Update profile
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const cand = await Candidate.findById(userId);
    if (!cand) return res.status(404).json({ status: false, message: 'Candidate not found' });
    const { name, phone, gender } = req.body;
    if (name) cand.name = name;
    if (phone) cand.phone = phone;
    if (gender) cand.gender = gender;
    // resume handled via multipart route
    await cand.save();
    return res.status(200).json({ status: true, message: 'Profile updated', data: cand });
  } catch (err) {
    return res.status(500).json({ status: false, message: 'Failed to update profile', error: err.message });
  }
};

// Apply to a job (multipart form expected: resume file)
export const applyToJob = async (req, res) => {
  try {
    const { jobId, name, email, phone, coverLetter, experience, skills } = req.body;
    if (!jobId) return res.status(400).json({ status: false, message: 'jobId is required' });
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ status: false, message: 'Job not found' });

    // Candidate may be logged-in or anonymous
    let candidate = null;
    if (req.user && req.user._id) {
      candidate = await Candidate.findById(req.user._id);
    }

    // If not logged in, try to find an existing candidate by email to avoid duplicate key errors.
    // If email is provided and a candidate exists, reuse it. Otherwise create a lightweight record.
    if (!candidate) {
      if (email) {
        candidate = await Candidate.findOne({ email: email });
      }
      if (!candidate) {
        candidate = new Candidate({ name: name || 'Applicant', email: email || '', phone: phone || '' });
      } else {
        // update contact info if we received new values
        if (name && !candidate.name) candidate.name = name;
        if (phone && !candidate.phone) candidate.phone = phone;
      }
    }

    // Attach resume if uploaded
    if (req.file) {
      candidate.resume = { filename: req.file.originalname || req.file.filename, url: req.file.path || req.file.location || req.file?.path };
    }
    // Or accept a resume link provided by the client (e.g., Google Drive URL)
    else if (req.body && (req.body.resumeLink || req.body.resumeUrl)) {
      const link = req.body.resumeLink || req.body.resumeUrl;
      candidate.resume = { filename: '', url: link };
    }

    // normalize skills (accept comma-separated string or array)
    let skillsArr = [];
    if (skills) {
      if (Array.isArray(skills)) skillsArr = skills.map(s => String(s).trim()).filter(Boolean);
      else if (typeof skills === 'string') skillsArr = skills.split(',').map(s => s.trim()).filter(Boolean);
    }

    // normalize experience
    const expNum = experience !== undefined && experience !== null ? parseInt(String(experience), 10) : undefined;

    // Add application entry to candidate
    const application = {
      job: job._id,
      resume: candidate.resume || {},
      coverLetter: coverLetter || '',
      experience: isNaN(expNum) ? undefined : expNum,
      skills: skillsArr,
      status: 'applied',
      appliedAt: new Date(),
    };
    candidate.applications = candidate.applications || [];
    candidate.applications.push(application);
    await candidate.save();

    // Add candidate reference to job and push application details into the job document
    try {
      await Job.findByIdAndUpdate(job._id, {
        $addToSet: { applications: candidate._id },
        $push: { applicationsDetails: {
          candidate: candidate._id,
          resume: candidate.resume || {},
          coverLetter: coverLetter || '',
          experience: isNaN(expNum) ? undefined : expNum,
          skills: skillsArr,
          status: 'applied',
          appliedAt: new Date()
        } }
      });
    } catch (e) {
      console.error('Failed to update job with application details', e);
      // don't fail the whole request if job update has a problem; candidate already has the application
    }

    return res.status(201).json({ status: true, message: 'Application submitted', data: { candidateId: candidate._id, application } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: 'Failed to apply', error: err.message });
  }
};
