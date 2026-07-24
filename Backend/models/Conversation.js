import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["dm", "group", "sector", "sub_sector", "sub_sub_sector", "org"],
      required: true,
    },
    name: { type: String, default: "" },
    description: { type: String, default: "" },
    /** When true, org sync will not overwrite name from sector label */
    nameCustomized: { type: Boolean, default: false },
    /** Linked org unit for auto channels */
    sectorRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sector",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
      },
    ],
    /** Users who deleted/hid this DM from their sidebar (still members) */
    hiddenFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
      },
    ],
    /** For DMs only: sorted pair key "idA:idB" — omit field when not a DM */
    dmKey: { type: String },
    isPrivate: { type: Boolean, default: true },
    avatar: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, default: "" },
    lastMessageSender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ members: 1, lastMessageAt: -1 });
conversationSchema.index(
  { type: 1, sectorRef: 1 },
  {
    unique: true,
    partialFilterExpression: { sectorRef: { $type: "objectId" } },
  }
);
// Unique only when dmKey is actually set (never index null)
conversationSchema.index(
  { dmKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dmKey: { $type: "string" } },
  }
);

export default mongoose.model("Conversation", conversationSchema);
