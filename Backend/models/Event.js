import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      default: "09:00",
    },
    duration: {
      type: Number,
      default: 60,
    },
    type: {
      type: String,
      enum: [
        "meeting",
        "holiday",
        "training",
        "personal",
        "announcement",
        "other",
      ],
      default: "meeting",
    },
    location: {
      type: String,
    },
    attendees: [
      {
        type: String,
      },
    ],
    color: {
      type: String,
      default: "bg-gray-500",
    },
    /** Who can see this event */
    visibilityScope: {
      type: String,
      enum: ["organization", "sector", "sub_sector", "sub_sub_sector"],
      default: "organization",
      index: true,
    },
    sectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sector",
      default: null,
      index: true,
    },
    subSectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sector",
      default: null,
      index: true,
    },
    subSubSectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sector",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
  },
  { timestamps: true }
);

eventSchema.index({ visibilityScope: 1, sectorId: 1, subSectorId: 1, date: 1 });

export default mongoose.model("Event", eventSchema);
