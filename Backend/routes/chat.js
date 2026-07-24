import express from "express";
import authorize from "../middlewares/authorize.js";
import { ALL_STAFF_ROLES } from "../utils/roles.js";
import { handleChatUpload } from "../config/multerChat.js";
import {
  listDirectory,
  listConversations,
  getOrCreateDm,
  createGroup,
  inviteMembers,
  leaveConversation,
  rejoinConversation,
  listLeftChannels,
  listMessages,
  sendMessage,
  uploadChatFiles,
  editMessage,
  deleteMessage,
  removeMember,
  getConversation,
  renameConversation,
  deleteConversation,
} from "../controllers/chatController.js";

const router = express.Router();

router.use(authorize(ALL_STAFF_ROLES));

router.get("/directory", listDirectory);
router.get("/conversations", listConversations);
router.get("/channels/left", listLeftChannels);
router.get("/conversations/:id", getConversation);
router.patch("/conversations/:id", renameConversation);
router.delete("/conversations/:id", deleteConversation);
router.post("/dm", getOrCreateDm);
router.post("/groups", createGroup);
router.post("/conversations/:id/invite", inviteMembers);
router.post("/conversations/:id/leave", leaveConversation);
router.post("/conversations/:id/rejoin", rejoinConversation);
router.post("/conversations/:id/members/remove", removeMember);
router.get("/conversations/:id/messages", listMessages);
router.post(
  "/conversations/:id/messages",
  handleChatUpload("files", 5),
  sendMessage
);
router.post("/upload", handleChatUpload("files", 5), uploadChatFiles);
router.patch("/messages/:messageId", editMessage);
router.delete("/messages/:messageId", deleteMessage);

export default router;
