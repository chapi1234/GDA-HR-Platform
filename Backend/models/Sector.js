import mongoose from "mongoose";

const sectorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    level: {
      type: String,
      enum: ["sector", "sub_sector", "sub_sub_sector"],
      required: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sector",
      default: null,
    },
    // Denormalized path labels for display: ["Business Sector", "Tourism Development", "40 Springs"]
    pathNames: { type: [String], default: [] },
    // Ancestor ids from root to parent (not including self)
    ancestors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Sector" }],
    head: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    location: { type: String, default: "" },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    employeeCount: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

sectorSchema.index({ parent: 1, name: 1 }, { unique: true });
sectorSchema.index({ level: 1 });

export default mongoose.model("Sector", sectorSchema);
