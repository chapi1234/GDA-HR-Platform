import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true }, // laptop | tablet | phone | monitor | camera | motorcycle | other
    brand: { type: String },
    model: { type: String },
    serialNumber: { type: String, unique: true, sparse: true },

    // Computing (PC / laptop / tablet / phone / monitor)
    ram: { type: String },
    storage: { type: String },

    // Camera
    megapixels: { type: String },
    resolution: { type: String },
    lens: { type: String },

    // Motorcycle
    plateNumber: { type: String },
    chassisNumber: { type: String },
    engineCc: { type: String },
    color: { type: String },
    year: { type: String },

    // Other (uncategorized) devices
    otherType: { type: String }, // free-form kind, e.g. Projector, Printer
    specs: { type: String }, // free-form specifications

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    assignedDate: { type: Date },
    returnDate: { type: Date },
    /** Deadline for the holder to return the device */
    returnDueDate: { type: Date },
    /** Last day a return-due reminder was sent (avoid duplicate daily reminders) */
    returnReminderSentAt: { type: Date },
    /** Sector lead who requested a pending assignment */
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    location: { type: String },
    purchaseDate: { type: Date },
    status: {
      type: String,
      enum: [
        "assigned",
        "pending_approval",
        "available",
        "maintenance",
        "lost",
        "retired",
      ],
      default: "available",
    },
    condition: { type: String },
    notes: { type: String },
    history: [
      {
        employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
        action: {
          type: String,
          enum: [
            "requested",
            "approved",
            "rejected",
            "assigned",
            "returned",
            "maintenance",
            "lost",
            "retired",
          ],
        },
        date: { type: Date, default: Date.now },
        notes: { type: String },
        location: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Device", deviceSchema);
