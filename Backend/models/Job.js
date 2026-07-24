import mongoose, { mongo } from 'mongoose';

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  /** Preferred org placement (Sector / Sub-sector / Unit) */
  sectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sector', default: null },
  unitPath: { type: String, default: '' },
  /** @deprecated legacy Department ref — kept for old job docs */
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: false },
  description: String,
  requirements: [String],
  location: String,
  salaryRange: {
    min: Number,
    max: Number
  },
  jobType: {
    type: String,
    // Keep values human-friendly to match frontend labels (e.g. "Full-time")
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship'],
    default: 'Full-time'
  },
  status: {
    type: String,
    // Align status values with frontend filter options (active/closed/draft)
    enum: ['active', 'closed', 'draft'],
    default: 'active'
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  postedDate: { type: Date, default: Date.now },
  closingDate: Date,
  applications: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate'
  }],
  // store application details on the job as well (candidate ref + metadata)
  applicationsDetails: [{
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
    resume: {
      filename: String,
      url: String,
    },
    coverLetter: String,
    experience: Number,
    skills: [String],
    status: { type: String, default: 'applied' },
    appliedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

export default mongoose.model('Job', jobSchema);
