import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { socketRoomsForUser } from "./utils/eventScope.js";
import Conversation from "./models/Conversation.js";

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "https://gammoda.vercel.app",
        "http://localhost:8080",
        "http://localhost:3000",
        "https://gammoda-public-portifolio.vercel.app",
      ],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (socket.handshake.headers?.authorization || "").replace(/^Bearer\s+/i, "");

      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const rooms = socketRoomsForUser(socket.user);
    for (const room of rooms) {
      socket.join(room);
    }
    const uid = socket.user?._id || socket.user?.id;
    if (uid) socket.join(`user:${String(uid)}`);
    socket.emit("ready", {
      rooms: [...rooms, uid ? `user:${String(uid)}` : null].filter(Boolean),
    });

    socket.on("chat:join", async (conversationId, ack) => {
      try {
        if (!conversationId || !uid) return ack?.({ ok: false });
        const conv = await Conversation.findById(conversationId).select("members");
        if (!conv) return ack?.({ ok: false, error: "Not found" });
        const isMember = (conv.members || []).some(
          (m) => String(m) === String(uid)
        );
        if (!isMember) return ack?.({ ok: false, error: "Forbidden" });
        socket.join(`chat:${conversationId}`);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on("chat:leave", (conversationId) => {
      if (conversationId) socket.leave(`chat:${conversationId}`);
    });

    socket.on("chat:typing", ({ conversationId, typing }) => {
      if (!conversationId) return;
      socket.to(`chat:${conversationId}`).emit("chat:typing", {
        conversationId,
        userId: uid,
        typing: !!typing,
      });
    });

    socket.on("chat:send", async (payload, ack) => {
      try {
        const conversationId = payload?.conversationId;
        const body = payload?.body;
        const attachments = payload?.attachments || [];
        if (!conversationId || !uid) {
          return ack?.({ ok: false, error: "Invalid payload" });
        }
        const { persistAndBroadcastMessage } = await import(
          "./controllers/chatController.js"
        );
        const message = await persistAndBroadcastMessage({
          conversationId,
          senderId: uid,
          body,
          attachments,
        });
        ack?.({ ok: true, data: message });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });
  });

  return io;
}

export function getIO() {
  return io;
}

/** Emit a new announcement/event to the correct audience room */
export function emitAnnouncement(audienceRoom, payload) {
  if (!io) return;
  const room = audienceRoom || "org";
  io.to(room).emit("announcement:new", payload);
}

/** Emit a personal notification to one employee (JWT subject = Employee _id) */
export function emitToUser(employeeId, event, payload) {
  if (!io || !employeeId) return;
  io.to(`user:${String(employeeId)}`).emit(event, payload);
}

/** True if this employee currently has a socket in the chat room (viewing the thread) */
export function isUserInChatRoom(employeeId, conversationId) {
  if (!io || !employeeId || !conversationId) return false;
  const userRoom = io.sockets.adapter.rooms.get(`user:${String(employeeId)}`);
  const chatRoom = io.sockets.adapter.rooms.get(`chat:${String(conversationId)}`);
  if (!userRoom?.size || !chatRoom?.size) return false;
  for (const socketId of userRoom) {
    if (chatRoom.has(socketId)) return true;
  }
  return false;
}
