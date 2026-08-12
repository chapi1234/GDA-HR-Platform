import mongoose from "mongoose";

const EmployeeSchema = new mongoose.Schema(
  {
    // Auth & Account
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: [
        "superadmin",
        "admin",
        "hr",
        "sector_lead",
        "manager",
        "unit_manager",
        "employee",
      ],
      default: "employee",
    },
    scopeLevel: {
      type: String,
      enum: ["organization", "sector", "sub_sector", "sub_sub_sector"],
      default: "sub_sector",
    },
    // Organizational placement (new hierarchy)
    sectorId: { type: mongoose.Schema.Types.ObjectId, ref: "Sector", default: null },
    subSectorId: { type: mongoose.Schema.Types.ObjectId, ref: "Sector", default: null },
    subSubSectorId: { type: mongoose.Schema.Types.ObjectId, ref: "Sector", default: null },
    lastLogin: {
      type: Date,
      default: Date.now,
    },

    // Personal Info
    name: { type: String, required: true },
    phone: String,
    gender: { type: String, enum: ["M", "F"], default: "M" },
    dateOfBirth: Date,
    profileImage: { type: String },
    address: { type: String },
    nationality: { type: String, default: "Ethiopian" },
    bio: { type: String },
    skills: { type: String },

    // Employment Info
    position: { type: String },
    // Legacy department support (kept for backward compatibility during migration)
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    employeeId: { type: String },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ["active", "inactive", "terminated"],
      default: "active",
    },
    salary: { type: Number },
    payType: {
      type: String,
      enum: ["hourly", "salary"],
      default: "salary",
    },
    // Bank details for payment export (GaDA default: CBE)
    bankName: { type: String, default: "Commercial Bank of Ethiopia" },
    bankAccountName: { type: String, default: "" },
    bankAccountNumber: { type: String, default: "" },
    bankBranch: { type: String, default: "" },
    gradeLevel: { type: String },
    nationalId: { type: String },
    emergencyContact: { type: String },
    emergencyPhone: { type: String },
    resume: {
      name: String,
      type: String,
      url: String,
      uploadDate: { type: Date, default: Date.now },
    },

    education: [
      {
        institution: String,
        degree: String,
        fieldOfStudy: String,
        graduationYear: Number,
      },
    ],
    /** Previous employers before joining GammoDA */
    workHistory: [
      {
        company: { type: String, required: true },
        position: { type: String },
        startDate: { type: String }, // YYYY-MM or YYYY-MM-DD
        endDate: { type: String }, // empty / null = still there or unknown
        description: { type: String },
      },
    ],
    certifications: [
      {
        name: String,
        issuingOrganization: String,
        issueDate: Date,
        expirationDate: Date,
      },
    ],
    documents: [
      {
        name: String,
        type: String,
        url: String,
        uploadDate: { type: Date, default: Date.now },
      },
    ],
    customFields: [
      {
        fieldName: String,
        fieldValue: String,
      },
    ],
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
    /** Conversations the user chose to leave (won't be auto-rejoined) */
    chatOptOut: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
    ],
  },
  {
    timestamps: true,
  }
);

EmployeeSchema.index({ sectorId: 1, subSectorId: 1, role: 1 });

export default mongoose.model("Employee", EmployeeSchema);
