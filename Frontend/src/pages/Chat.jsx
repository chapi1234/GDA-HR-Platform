import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import { Label } from "../components/ui/label";
import {
  MessageSquare,
  Search,
  Plus,
  Send,
  Users,
  Hash,
  UserPlus,
  Building2,
  Paperclip,
  X,
  Pencil,
  Trash2,
  LogOut,
  RotateCcw,
  FileIcon,
  MoreHorizontal,
  UserMinus,
  ChevronDown,
  Info,
} from "lucide-react";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_URL;

function initials(name = "") {
  return name
    .split(" ")
    .map((n) => n[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function typeMeta(type) {
  if (type === "dm") return { label: "DM", icon: MessageSquare };
  if (type === "group") return { label: "Group", icon: Users };
  if (type === "org") return { label: "Org", icon: Building2 };
  return { label: "Channel", icon: Hash };
}

function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function isImageAttachment(a) {
  return (
    a?.resourceType === "image" ||
    (a?.mimeType || "").startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(a?.name || a?.url || "")
  );
}

function previewFromMessage(msg) {
  if (msg?.deleted) return "Message deleted";
  const text = (msg?.body || "").trim();
  if (text) return text.slice(0, 140);
  const file = msg?.attachments?.[0];
  if (!file) return "";
  return isImageAttachment(file)
    ? "📷 Image"
    : `📎 ${file.name || "Attachment"}`;
}

const Chat = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const myId = String(user?.id || user?._id || "");
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  const canModerate = ["superadmin", "admin", "hr"].includes(
    String(user?.role || "").toLowerCase()
  );

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeDetail, setActiveDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [filter, setFilter] = useState("all");
  const [searchConv, setSearchConv] = useState("");
  const [typingUsers, setTypingUsers] = useState({});

  const [dmOpen, setDmOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [deleteDmConfirmOpen, setDeleteDmConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deletingDm, setDeletingDm] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [leftChannels, setLeftChannels] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [dirQuery, setDirQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [selectedPeople, setSelectedPeople] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [menuMsgId, setMenuMsgId] = useState(null);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimer = useRef(null);
  const activeIdRef = useRef(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const active = useMemo(() => {
    const fromList = conversations.find((c) => String(c.id) === String(activeId));
    if (activeDetail && String(activeDetail.id) === String(activeId)) {
      return { ...fromList, ...activeDetail };
    }
    return fromList || null;
  }, [conversations, activeId, activeDetail]);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingList(true);
      const res = await axios.get(`${API_URL}/api/chat/conversations`, { headers });
      setConversations(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load chats");
    } finally {
      setLoadingList(false);
    }
  }, [token, headers]);

  const loadLeftChannels = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/api/chat/channels/left`, { headers });
      setLeftChannels(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error(err);
    }
  }, [token, headers]);

  const loadDirectory = useCallback(
    async (q = "") => {
      if (!token) return;
      try {
        const res = await axios.get(`${API_URL}/api/chat/directory`, {
          headers,
          params: { q },
        });
        setDirectory(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (err) {
        console.error(err);
      }
    },
    [token, headers]
  );

  const refreshActiveDetail = useCallback(
    async (id) => {
      if (!id || !token) return;
      try {
        const res = await axios.get(`${API_URL}/api/chat/conversations/${id}`, { headers });
        if (res.data?.data) setActiveDetail(res.data.data);
      } catch {
        /* ignore — may have left */
      }
    },
    [token, headers]
  );

  const openConversation = useCallback(
    async (id) => {
      if (!id || !token) return;
      const prevId = activeIdRef.current;
      if (prevId && String(prevId) !== String(id)) {
        socketRef.current?.emit("chat:leave", prevId);
      }
      setActiveId(id);
      setLoadingMsgs(true);
      setMessages([]);
      setPendingFiles([]);
      setEditingId(null);
      setMenuMsgId(null);
      setActiveDetail(null);
      try {
        const [msgRes] = await Promise.all([
          axios.get(`${API_URL}/api/chat/conversations/${id}/messages`, { headers }),
          refreshActiveDetail(id),
        ]);
        setMessages(Array.isArray(msgRes.data?.data) ? msgRes.data.data : []);
        setConversations((prev) =>
          prev.map((c) => (String(c.id) === String(id) ? { ...c, unread: 0 } : c))
        );
        socketRef.current?.emit("chat:join", id);
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load messages");
      } finally {
        setLoadingMsgs(false);
      }
    },
    [token, headers, refreshActiveDetail]
  );

  useEffect(() => {
    loadConversations();
    loadLeftChannels();
  }, [loadConversations, loadLeftChannels]);

  // Open conversation from notification link: /chat?c=<id>
  useEffect(() => {
    const c = searchParams.get("c");
    if (!c || !token || loadingList) return;
    openConversation(c);
    setSearchParams({}, { replace: true });
  }, [searchParams, token, loadingList, openConversation, setSearchParams]);

  useEffect(() => {
    if (!token) return;
    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("chat:message", (msg) => {
      const cid = String(msg.conversationId);
      if (cid === String(activeIdRef.current)) {
        setMessages((prev) => {
          if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
          return [...prev, msg];
        });
      }
      setConversations((prev) => {
        const next = prev.map((c) => {
          if (String(c.id) !== cid) return c;
          const isActive = cid === String(activeIdRef.current);
          const fromOther = String(msg.sender?.id) !== myId;
          return {
            ...c,
            lastMessageAt: msg.createdAt,
            lastMessagePreview: previewFromMessage(msg),
            lastMessageSender: msg.sender,
            unread: isActive || !fromOther ? 0 : (c.unread || 0) + 1,
          };
        });
        return [...next].sort(
          (a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
        );
      });
    });

    socket.on("chat:message_updated", (msg) => {
      const cid = String(msg.conversationId);
      if (cid === String(activeIdRef.current)) {
        setMessages((prev) =>
          prev.map((m) => (String(m.id) === String(msg.id) ? msg : m))
        );
      }
      setConversations((prev) =>
        prev.map((c) =>
          String(c.id) === cid
            ? { ...c, lastMessagePreview: previewFromMessage(msg) }
            : c
        )
      );
    });

    socket.on("chat:message_notify", (payload) => {
      const cid = String(payload.conversationId);
      if (cid === String(activeIdRef.current)) return;
      setConversations((prev) => {
        const exists = prev.some((c) => String(c.id) === cid);
        if (!exists) {
          loadConversations();
          return prev;
        }
        return prev
          .map((c) =>
            String(c.id) === cid
              ? {
                  ...c,
                  lastMessageAt: payload.createdAt,
                  lastMessagePreview: payload.preview,
                  lastMessageSender: payload.sender,
                  unread: (c.unread || 0) + 1,
                }
              : c
          )
          .sort(
            (a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
          );
      });
    });

    socket.on("chat:conversation", () => {
      loadConversations();
    });

    socket.on("chat:conversation_updated", (conv) => {
      if (!conv?.id) return;
      setConversations((prev) =>
        prev.map((c) => (String(c.id) === String(conv.id) ? { ...c, ...conv } : c))
      );
      if (String(conv.id) === String(activeIdRef.current)) {
        setActiveDetail((prev) => ({ ...(prev || {}), ...conv }));
      }
    });

    socket.on("chat:removed", ({ conversationId }) => {
      if (String(conversationId) === String(activeIdRef.current)) {
        setActiveId(null);
        setActiveDetail(null);
        setMessages([]);
        toast.info("You were removed from this conversation");
      }
      loadConversations();
      loadLeftChannels();
    });

    socket.on("chat:typing", ({ conversationId, userId, typing }) => {
      if (String(conversationId) !== String(activeIdRef.current)) return;
      if (String(userId) === myId) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (typing) next[userId] = true;
        else delete next[userId];
        return next;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, myId, loadConversations, loadLeftChannels]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (filter === "dms" && c.type !== "dm") return false;
      if (filter === "groups" && c.type !== "group") return false;
      if (
        filter === "channels" &&
        !["sector", "sub_sector", "sub_sub_sector", "org"].includes(c.type)
      ) {
        return false;
      }
      const q = searchConv.trim().toLowerCase();
      if (!q) return true;
      return (
        (c.name || "").toLowerCase().includes(q) ||
        (c.lastMessagePreview || "").toLowerCase().includes(q)
      );
    });
  }, [conversations, filter, searchConv]);

  const onPickFiles = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setPendingFiles((prev) => {
      const mapped = files.map((f) => ({
        file: f,
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      }));
      const next = [...prev, ...mapped].slice(0, 5);
      if (prev.length + files.length > 5) toast.info("Max 5 files per message");
      return next;
    });
  };

  const removePendingFile = (idx) => {
    setPendingFiles((prev) => {
      const item = prev[idx];
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const send = async () => {
    const body = draft.trim();
    if ((!body && !pendingFiles.length) || !activeId || sending) return;
    setSending(true);
    setDraft("");
    const filesToSend = [...pendingFiles];
    setPendingFiles([]);
    socketRef.current?.emit("chat:typing", { conversationId: activeId, typing: false });

    const optimistic = {
      id: `tmp-${Date.now()}`,
      conversationId: activeId,
      body,
      attachments: filesToSend.map((p) => ({
        url: p.previewUrl || "",
        name: p.file.name,
        mimeType: p.file.type,
        resourceType: p.file.type.startsWith("image/") ? "image" : "raw",
        local: true,
      })),
      sender: {
        id: myId,
        name: user?.name,
        avatar: user?.avatar || user?.profileImage,
      },
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      if (filesToSend.length) {
        const form = new FormData();
        form.append("body", body);
        filesToSend.forEach((p) => form.append("files", p.file));
        const res = await axios.post(
          `${API_URL}/api/chat/conversations/${activeId}/messages`,
          form,
          { headers: { ...headers, "Content-Type": "multipart/form-data" } }
        );
        filesToSend.forEach((p) => {
          if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
        });
        const data = res.data?.data;
        setMessages((prev) => {
          const withoutTmp = prev.filter((m) => m.id !== optimistic.id);
          if (!data) return withoutTmp;
          if (withoutTmp.some((m) => String(m.id) === String(data.id))) return withoutTmp;
          return [...withoutTmp, data];
        });
      } else {
        await new Promise((resolve) => {
          socketRef.current?.emit(
            "chat:send",
            { conversationId: activeId, body },
            (ack) => {
              if (!ack?.ok) {
                toast.error(ack?.error || "Failed to send");
                setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
                setDraft(body);
                resolve();
                return;
              }
              setMessages((prev) => {
                const withoutTmp = prev.filter((m) => m.id !== optimistic.id);
                if (withoutTmp.some((m) => String(m.id) === String(ack.data.id))) {
                  return withoutTmp;
                }
                return [...withoutTmp, ack.data];
              });
              resolve();
            }
          );
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
      setPendingFiles(filesToSend);
    } finally {
      setSending(false);
    }
  };

  const onDraftChange = (value) => {
    setDraft(value);
    if (!activeId) return;
    socketRef.current?.emit("chat:typing", { conversationId: activeId, typing: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit("chat:typing", { conversationId: activeId, typing: false });
    }, 1200);
  };

  const saveEdit = async (messageId) => {
    const body = editDraft.trim();
    if (!body) {
      toast.error("Message cannot be empty");
      return;
    }
    try {
      const res = await axios.patch(
        `${API_URL}/api/chat/messages/${messageId}`,
        { body },
        { headers }
      );
      const data = res.data?.data;
      if (data) {
        setMessages((prev) =>
          prev.map((m) => (String(m.id) === String(data.id) ? data : m))
        );
      }
      setEditingId(null);
      setEditDraft("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to edit");
    }
  };

  const deleteMsg = async (messageId) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      const reason = canModerate ? "Removed by moderator" : "";
      const res = await axios.delete(`${API_URL}/api/chat/messages/${messageId}`, {
        headers,
        data: { reason },
      });
      const data = res.data?.data;
      if (data) {
        setMessages((prev) =>
          prev.map((m) => (String(m.id) === String(data.id) ? data : m))
        );
      }
      setMenuMsgId(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    }
  };

  const requestLeaveChat = () => {
    if (!activeId || active?.type === "dm") return;
    setDetailsOpen(false);
    setLeaveConfirmOpen(true);
  };

  const confirmLeaveChat = async () => {
    if (!activeId) return;
    setLeaving(true);
    try {
      await axios.post(
        `${API_URL}/api/chat/conversations/${activeId}/leave`,
        {},
        { headers }
      );
      toast.success("Left conversation");
      setLeaveConfirmOpen(false);
      setActiveId(null);
      setActiveDetail(null);
      setMessages([]);
      await loadConversations();
      await loadLeftChannels();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not leave");
    } finally {
      setLeaving(false);
    }
  };

  const requestDeleteDm = () => {
    if (!activeId || active?.type !== "dm") return;
    setDetailsOpen(false);
    setDeleteDmConfirmOpen(true);
  };

  const confirmDeleteDm = async () => {
    if (!activeId) return;
    setDeletingDm(true);
    try {
      await axios.delete(`${API_URL}/api/chat/conversations/${activeId}`, {
        headers,
      });
      toast.success("Chat removed from your list");
      setDeleteDmConfirmOpen(false);
      setActiveId(null);
      setActiveDetail(null);
      setMessages([]);
      await loadConversations();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete chat");
    } finally {
      setDeletingDm(false);
    }
  };

  const rejoinChannel = async (id) => {
    try {
      const res = await axios.post(
        `${API_URL}/api/chat/conversations/${id}/rejoin`,
        {},
        { headers }
      );
      toast.success("Rejoined channel");
      setLeftOpen(false);
      await loadConversations();
      await loadLeftChannels();
      if (res.data?.data?.id) openConversation(res.data.data.id);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not rejoin");
    }
  };

  const removeMemberFromChat = async (userId, name) => {
    if (!activeId) return;
    if (!window.confirm(`Remove ${name || "this member"}?`)) return;
    try {
      const res = await axios.post(
        `${API_URL}/api/chat/conversations/${activeId}/members/remove`,
        { userId },
        { headers }
      );
      if (res.data?.data) setActiveDetail(res.data.data);
      toast.success("Member removed");
      await loadConversations();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not remove member");
    }
  };

  const saveChannelName = async () => {
    if (!activeId) return;
    const name = nameDraft.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    setSavingName(true);
    try {
      const res = await axios.patch(
        `${API_URL}/api/chat/conversations/${activeId}`,
        { name, description: descDraft.trim() },
        { headers }
      );
      const data = res.data?.data;
      if (data) {
        setActiveDetail(data);
        setConversations((prev) =>
          prev.map((c) =>
            String(c.id) === String(data.id)
              ? { ...c, name: data.name, description: data.description }
              : c
          )
        );
      }
      setEditingName(false);
      toast.success("Channel updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not rename");
    } finally {
      setSavingName(false);
    }
  };

  const startDm = async (person) => {
    try {
      const res = await axios.post(
        `${API_URL}/api/chat/dm`,
        { userId: person.id },
        { headers }
      );
      const conv = res.data?.data;
      if (!conv) throw new Error("No conversation");
      setDmOpen(false);
      await loadConversations();
      openConversation(conv.id);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start DM");
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Enter a group name");
      return;
    }
    try {
      const res = await axios.post(
        `${API_URL}/api/chat/groups`,
        {
          name: groupName.trim(),
          description: groupDesc.trim(),
          memberIds: selectedPeople,
        },
        { headers }
      );
      const conv = res.data?.data;
      setGroupOpen(false);
      setGroupName("");
      setGroupDesc("");
      setSelectedPeople([]);
      await loadConversations();
      if (conv?.id) openConversation(conv.id);
      toast.success("Group created");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create group");
    }
  };

  const inviteToGroup = async () => {
    if (!activeId || !selectedPeople.length) return;
    try {
      await axios.post(
        `${API_URL}/api/chat/conversations/${activeId}/invite`,
        { memberIds: selectedPeople },
        { headers }
      );
      setInviteOpen(false);
      setSelectedPeople([]);
      await loadConversations();
      await refreshActiveDetail(activeId);
      toast.success("Users added to channel");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not add users");
    }
  };

  const togglePerson = (id) => {
    setSelectedPeople((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const MetaIcon = typeMeta(active?.type).icon;
  const canLeave = active && active.type !== "dm";
  const canDeleteDm = active && active.type === "dm";
  const canInvite = !!(
    active &&
    (typeof active.canInvite === "boolean"
      ? active.canInvite
      : active.type === "group" || active.type === "dm")
  );
  const canManageMembers =
    active &&
    active.type !== "dm" &&
    (canModerate ||
      (active.type === "group" &&
        String(active.createdBy) === myId));

  const openChannelDetails = () => {
    if (!activeId) return;
    setMemberQuery("");
    setEditingName(false);
    setNameDraft(active?.name || "");
    setDescDraft(active?.description || "");
    setDetailsOpen(true);
    refreshActiveDetail(activeId);
  };

  const filteredMembers = useMemo(() => {
    const list = active?.members || [];
    const q = memberQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) =>
        (m.name || "").toLowerCase().includes(q) ||
        (m.role || "").toLowerCase().includes(q)
    );
  }, [active?.members, memberQuery]);

  const roleLabel = (role) => {
    const r = String(role || "").toLowerCase();
    if (r === "superadmin") return "Super Admin";
    if (r === "admin") return "Admin";
    if (r === "hr") return "HR";
    if (r === "sector_lead") return "Sector Lead";
    if (r === "manager") return "Manager";
    if (r === "unit_manager") return "Unit Manager";
    if (r === "employee") return "Employee";
    return role || "Member";
  };

  return (
    <div className="container mx-auto p-4 md:p-6 h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)]">
      <div className="flex flex-col h-full gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Chat</h1>
            <p className="text-muted-foreground text-sm">
              Direct messages, sector channels, and custom groups
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {leftChannels.length > 0 ? (
              <Button
                variant="outline"
                onClick={() => {
                  setLeftOpen(true);
                  loadLeftChannels();
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Rejoin ({leftChannels.length})
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => {
                setDmOpen(true);
                loadDirectory();
              }}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              New DM
            </Button>
            <Button
              className="btn-gradient"
              onClick={() => {
                setGroupOpen(true);
                loadDirectory();
                setSelectedPeople([]);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Group
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <div className="rounded-2xl border border-border bg-card flex flex-col min-h-0 overflow-hidden">
            <div className="p-3 border-b border-border space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search chats..."
                  value={searchConv}
                  onChange={(e) => setSearchConv(e.target.value)}
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {[
                  ["all", "All"],
                  ["dms", "DMs"],
                  ["channels", "Channels"],
                  ["groups", "Groups"],
                ].map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={filter === key ? "default" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => setFilter(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {loadingList ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">Loading…</p>
                ) : filteredConversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">
                    No conversations yet. Start a DM or create a group.
                  </p>
                ) : (
                  filteredConversations.map((c) => {
                    const Icon = typeMeta(c.type).icon;
                    const activeRow = String(c.id) === String(activeId);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => openConversation(c.id)}
                        className={cn(
                          "w-full text-left rounded-xl px-3 py-2.5 transition-colors",
                          activeRow
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted/60 border border-transparent"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-lg bg-muted p-2">
                            <Icon className="w-4 h-4 text-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm truncate">{c.name}</p>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {formatTime(c.lastMessageAt)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <p className="text-xs text-muted-foreground truncate">
                                {c.lastMessagePreview || typeMeta(c.type).label}
                              </p>
                              {c.unread > 0 ? (
                                <Badge className="h-5 min-w-5 justify-center px-1.5 text-[10px]">
                                  {c.unread}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="rounded-2xl border border-border bg-card flex flex-col min-h-0 overflow-hidden">
            {!active ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <MessageSquare className="w-12 h-12 text-muted-foreground mb-3" />
                <h2 className="text-lg font-semibold">Select a conversation</h2>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                  Message anyone, join your sector channels, or create a private group.
                </p>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={openChannelDetails}
                    className="flex items-center gap-3 min-w-0 text-left rounded-xl px-1 py-0.5 -ml-1 hover:bg-muted/60 transition-colors group"
                    title="View channel details"
                  >
                    <div className="rounded-lg bg-muted p-2 group-hover:bg-background">
                      <MetaIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold truncate">{active.name}</p>
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 opacity-70 group-hover:opacity-100" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {typeMeta(active.type).label}
                        {active.memberCount
                          ? ` · ${active.memberCount} members`
                          : ""}
                        {active.description ? ` · ${active.description}` : ""}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={openChannelDetails}
                      title="Channel info"
                    >
                      <Info className="w-4 h-4" />
                    </Button>
                    {canLeave ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={requestLeaveChat}
                        title="Leave channel"
                      >
                        <LogOut className="w-4 h-4 mr-1" />
                        Leave
                      </Button>
                    ) : null}
                    {canDeleteDm ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={requestDeleteDm}
                        title="Delete chat"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    ) : null}
                    {canInvite ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setInviteOpen(true);
                          loadDirectory();
                          setSelectedPeople([]);
                        }}
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Add user
                      </Button>
                    ) : null}
                  </div>
                </div>

                <ScrollArea className="flex-1 px-4">
                  <div className="py-4 space-y-3">
                    {loadingMsgs ? (
                      <p className="text-sm text-muted-foreground text-center">
                        Loading messages…
                      </p>
                    ) : messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No messages yet. Say hello!
                      </p>
                    ) : (
                      messages.map((m) => {
                        const mine = String(m.sender?.id) === myId;
                        const canEditThis =
                          !m.deleted &&
                          editingId !== m.id &&
                          (active?.type === "dm"
                            ? mine
                            : mine || canModerate);
                        const canDeleteThis =
                          !m.deleted &&
                          (active?.type === "dm"
                            ? mine
                            : mine || canModerate);
                        return (
                          <div
                            key={m.id}
                            className={cn(
                              "flex gap-2 group",
                              mine ? "justify-end" : "justify-start"
                            )}
                          >
                            {!mine ? (
                              <Avatar className="w-8 h-8 mt-1">
                                <AvatarImage src={m.sender?.avatar} alt={m.sender?.name} />
                                <AvatarFallback className="text-[10px]">
                                  {initials(m.sender?.name)}
                                </AvatarFallback>
                              </Avatar>
                            ) : null}
                            <div
                              className={cn(
                                "relative max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                                m.deleted
                                  ? "bg-muted/50 text-muted-foreground italic rounded-2xl"
                                  : mine
                                    ? "bg-primary text-primary-foreground rounded-br-md"
                                    : "bg-muted text-foreground rounded-bl-md"
                              )}
                            >
                              {!mine && !m.deleted ? (
                                <p className="text-[11px] font-medium opacity-80 mb-0.5">
                                  {m.sender?.name}
                                </p>
                              ) : null}

                              {editingId === m.id ? (
                                <div className="space-y-2 min-w-[200px]">
                                  <Textarea
                                    value={editDraft}
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    className="min-h-[60px] text-foreground bg-background"
                                  />
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => saveEdit(m.id)}>
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingId(null);
                                        setEditDraft("");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : m.deleted ? (
                                <p className="text-sm">
                                  This message was deleted
                                  {m.deleteReason ? ` (${m.deleteReason})` : ""}
                                </p>
                              ) : (
                                <>
                                  {m.body ? (
                                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                                  ) : null}
                                  {(m.attachments || []).length > 0 ? (
                                    <div
                                      className={cn(
                                        "mt-2 space-y-2",
                                        m.body ? "" : ""
                                      )}
                                    >
                                      {m.attachments.map((a, i) =>
                                        isImageAttachment(a) ? (
                                          <a
                                            key={`${a.url}-${i}`}
                                            href={a.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block"
                                          >
                                            <img
                                              src={a.url}
                                              alt={a.name || "attachment"}
                                              className="max-h-56 rounded-lg object-cover max-w-full"
                                            />
                                          </a>
                                        ) : (
                                          <a
                                            key={`${a.url}-${i}`}
                                            href={a.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={cn(
                                              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                                              mine
                                                ? "bg-primary-foreground/15"
                                                : "bg-background/60"
                                            )}
                                          >
                                            <FileIcon className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate underline">
                                              {a.name || "File"}
                                            </span>
                                          </a>
                                        )
                                      )}
                                    </div>
                                  ) : null}
                                </>
                              )}

                              {!m.deleted ? (
                                <p
                                  className={cn(
                                    "text-[10px] mt-1",
                                    mine
                                      ? "text-primary-foreground/70"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  {formatTime(m.createdAt)}
                                  {m.editedAt ? " · edited" : ""}
                                  {m.pending ? " · sending" : ""}
                                </p>
                              ) : null}

                              {(canEditThis || canDeleteThis) && !m.pending ? (
                                <div
                                  className={cn(
                                    "absolute -top-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity",
                                    mine ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"
                                  )}
                                >
                                  <div className="relative">
                                    <Button
                                      size="icon"
                                      type="button"
                                      variant="outline"
                                      className="h-7 w-7 bg-background text-foreground border-border shadow-sm hover:bg-muted"
                                      onClick={() =>
                                        setMenuMsgId(
                                          menuMsgId === m.id ? null : m.id
                                        )
                                      }
                                    >
                                      <MoreHorizontal className="w-3.5 h-3.5 text-foreground" />
                                    </Button>
                                    {menuMsgId === m.id ? (
                                      <div className="absolute z-20 top-8 right-0 min-w-[120px] rounded-md border border-border bg-background text-foreground p-1 shadow-md">
                                        {canEditThis && m.body !== undefined ? (
                                          <button
                                            type="button"
                                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-foreground hover:bg-muted"
                                            onClick={() => {
                                              setEditingId(m.id);
                                              setEditDraft(m.body || "");
                                              setMenuMsgId(null);
                                            }}
                                          >
                                            <Pencil className="w-3 h-3" /> Edit
                                          </button>
                                        ) : null}
                                        {canDeleteThis ? (
                                          <button
                                            type="button"
                                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-destructive hover:bg-muted"
                                            onClick={() => deleteMsg(m.id)}
                                          >
                                            <Trash2 className="w-3 h-3" /> Delete
                                          </button>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                    {Object.keys(typingUsers).length > 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        Someone is typing…
                      </p>
                    ) : null}
                    <div ref={bottomRef} />
                  </div>
                </ScrollArea>

                <div className="p-3 border-t border-border space-y-2">
                  {pendingFiles.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {pendingFiles.map((p, i) => (
                        <div
                          key={`${p.file.name}-${i}`}
                          className="relative flex items-center gap-2 rounded-lg border bg-muted/40 px-2 py-1 text-xs max-w-[180px]"
                        >
                          {p.previewUrl ? (
                            <img
                              src={p.previewUrl}
                              alt=""
                              className="w-8 h-8 rounded object-cover"
                            />
                          ) : (
                            <FileIcon className="w-4 h-4 shrink-0" />
                          )}
                          <span className="truncate">{p.file.name}</span>
                          <button
                            type="button"
                            className="absolute -top-1.5 -right-1.5 rounded-full bg-background border p-0.5"
                            onClick={() => removePendingFile(i)}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex gap-2 items-end">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                      onChange={onPickFiles}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach files"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <Textarea
                      value={draft}
                      onChange={(e) => onDraftChange(e.target.value)}
                      placeholder={`Message ${active.name}…`}
                      className="min-h-[44px] max-h-32 resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                    />
                    <Button
                      onClick={send}
                      disabled={sending || (!draft.trim() && !pendingFiles.length)}
                      className="shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={dmOpen} onOpenChange={setDmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New direct message</DialogTitle>
            <DialogDescription>Message anyone in the organization</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Search people…"
            value={dirQuery}
            onChange={(e) => {
              setDirQuery(e.target.value);
              loadDirectory(e.target.value);
            }}
          />
          <ScrollArea className="h-72 mt-2">
            <div className="space-y-1 pr-2">
              {directory.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted text-left"
                  onClick={() => startDm(p)}
                >
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={p.avatar} alt={p.name} />
                    <AvatarFallback>{initials(p.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.unitPath || p.role}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a group</DialogTitle>
            <DialogDescription>Invite teammates to a private group chat</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Group name</Label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} />
            </div>
            <Input
              placeholder="Search people to add…"
              value={dirQuery}
              onChange={(e) => {
                setDirQuery(e.target.value);
                loadDirectory(e.target.value);
              }}
            />
            <ScrollArea className="h-56 border rounded-md">
              <div className="p-2 space-y-1">
                {directory.map((p) => {
                  const on = selectedPeople.includes(String(p.id));
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left",
                        on ? "bg-primary/10" : "hover:bg-muted"
                      )}
                      onClick={() => togglePerson(String(p.id))}
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={p.avatar} alt={p.name} />
                        <AvatarFallback>{initials(p.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1 truncate">{p.name}</span>
                      {on ? <Badge variant="secondary">Added</Badge> : null}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
            <Button className="w-full btn-gradient" onClick={createGroup}>
              Create group ({selectedPeople.length} members)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add users</DialogTitle>
            <DialogDescription>
              Select people from the organization to add to{" "}
              {active?.name ? `“${active.name}”` : "this channel"}
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Search people…"
            value={dirQuery}
            onChange={(e) => {
              setDirQuery(e.target.value);
              loadDirectory(e.target.value);
            }}
          />
          <ScrollArea className="h-64 mt-2">
            <div className="space-y-1">
              {directory.map((p) => {
                const on = selectedPeople.includes(String(p.id));
                const alreadyIn = (active?.members || []).some(
                  (m) => String(m.id || m._id || m) === String(p.id)
                );
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={alreadyIn}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left",
                      alreadyIn
                        ? "opacity-50 cursor-not-allowed"
                        : on
                          ? "bg-primary/10"
                          : "hover:bg-muted"
                    )}
                    onClick={() => {
                      if (!alreadyIn) togglePerson(String(p.id));
                    }}
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={p.avatar} alt={p.name} />
                      <AvatarFallback>{initials(p.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm truncate block">{p.name}</span>
                      <span className="text-[11px] text-muted-foreground capitalize">
                        {(p.role || "").replace(/_/g, " ")}
                      </span>
                    </div>
                    {alreadyIn ? (
                      <Badge variant="secondary">Member</Badge>
                    ) : on ? (
                      <Badge variant="secondary">Selected</Badge>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
          <Button onClick={inviteToGroup} disabled={!selectedPeople.length}>
            Add {selectedPeople.length || ""}{" "}
            {selectedPeople.length === 1 ? "user" : "users"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={leftOpen} onOpenChange={setLeftOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejoin channels</DialogTitle>
            <DialogDescription>
              Channels you left. Rejoin anytime to get updates again.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-72">
            <div className="space-y-2 pr-2">
              {leftChannels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No left channels
                </p>
              ) : (
                leftChannels.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {typeMeta(c.type).label}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => rejoinChannel(c.id)}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Rejoin
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this channel?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave{" "}
              <span className="font-medium text-foreground">
                {active?.name || "this channel"}
              </span>
              ? You will stop receiving messages here until you rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>No, stay</AlertDialogCancel>
            <AlertDialogAction
              disabled={leaving}
              onClick={(e) => {
                e.preventDefault();
                confirmLeaveChat();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leaving ? "Leaving…" : "Yes, leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDmConfirmOpen} onOpenChange={setDeleteDmConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove your DM with{" "}
              <span className="font-medium text-foreground">
                {active?.name || "this person"}
              </span>{" "}
              from your list? This only affects you — their chat stays. You can
              start a new DM with them anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDm}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingDm}
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteDm();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingDm ? "Deleting…" : "Yes, delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border text-left space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-muted p-3">
                <MetaIcon className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                {editingName ? (
                  <div className="space-y-2 pr-6">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        maxLength={80}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Textarea
                        value={descDraft}
                        onChange={(e) => setDescDraft(e.target.value)}
                        maxLength={300}
                        className="min-h-[64px] resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveChannelName} disabled={savingName}>
                        {savingName ? "Saving…" : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingName(false);
                          setNameDraft(active?.name || "");
                          setDescDraft(active?.description || "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 pr-6">
                      <SheetTitle className="truncate">
                        {active?.name || "Conversation"}
                      </SheetTitle>
                      {active?.canRename ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          title="Rename"
                          onClick={() => {
                            setNameDraft(active?.name || "");
                            setDescDraft(active?.description || "");
                            setEditingName(true);
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      ) : null}
                    </div>
                    <SheetDescription className="mt-1">
                      {typeMeta(active?.type).label}
                      {active?.memberCount != null
                        ? ` · ${active.memberCount} members`
                        : ""}
                    </SheetDescription>
                    {active?.description ? (
                      <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                        {active.description}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {active?.canRename && !editingName ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNameDraft(active?.name || "");
                    setDescDraft(active?.description || "");
                    setEditingName(true);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  Rename
                </Button>
              ) : null}
              {canLeave ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={requestLeaveChat}
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Leave
                </Button>
              ) : null}
              {canDeleteDm ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={requestDeleteDm}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete chat
                </Button>
              ) : null}
              {canInvite ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDetailsOpen(false);
                    setInviteOpen(true);
                    loadDirectory();
                    setSelectedPeople([]);
                  }}
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Add user
                </Button>
              ) : null}
            </div>
          </SheetHeader>

          <div className="px-6 py-3 border-b border-border">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" />
                Members
                <Badge variant="secondary" className="font-normal">
                  {(active?.members || []).length || active?.memberCount || 0}
                </Badge>
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 h-9"
                placeholder="Search members…"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
              />
            </div>
          </div>

          <ScrollArea className="flex-1 px-3">
            <div className="py-2 space-y-0.5">
              {filteredMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No members found
                </p>
              ) : (
                filteredMembers.map((m) => {
                  const mid = String(m.id || m._id || m);
                  const isMe = mid === myId;
                  const showRemove = canManageMembers && !isMe;
                  return (
                    <div
                      key={mid}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/60"
                    >
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={m.avatar} alt={m.name} />
                        <AvatarFallback>{initials(m.name || "?")}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {m.name || mid}
                          {isMe ? (
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              (you)
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {roleLabel(m.role)}
                        </p>
                      </div>
                      {showRemove ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive shrink-0"
                          title={`Remove ${m.name || "member"}`}
                          onClick={() => removeMemberFromChat(mid, m.name)}
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Chat;
