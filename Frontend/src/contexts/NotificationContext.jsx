import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { io } from "socket.io-client";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext";

const API_URL = import.meta.env.VITE_API_URL;
const READ_KEY = "gammoda_announcement_reads";

const NotificationContext = createContext(null);

function loadReadIds() {
  try {
    const raw = localStorage.getItem(READ_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(set) {
  localStorage.setItem(READ_KEY, JSON.stringify([...set]));
}

function mapAnnouncement(a) {
  return {
    id: String(a._id || a.id),
    title: a.title,
    description: a.description || "",
    type: a.type || "announcement",
    kind: "announcement",
    href: "/calendar",
    date: a.date,
    time: a.time,
    visibilityScope: a.visibilityScope || "organization",
    audienceLabel:
      a.visibilityScope === "organization"
        ? "Organization"
        : a.visibilityScope === "sector"
          ? "Sector"
          : a.visibilityScope === "sub_sector"
            ? "Sub-sector"
            : a.visibilityScope === "sub_sub_sector"
              ? "Unit"
              : "Team",
    createdAt: a.createdAt,
    createdByName: a.createdByName || a.createdBy?.name || null,
    readAt: null,
  };
}

function mapPersonal(n) {
  const kind = n.kind || "general";
  const href =
    kind === "salary_advance"
      ? "/salary-advances"
      : kind === "payroll_created"
        ? "/salary"
        : kind === "payslip_ready"
          ? "/payslips"
          : kind === "chat_message"
            ? n.href || "/chat"
            : n.href || "/salary";
  return {
    id: String(n._id || n.id),
    title: n.title,
    description: n.description || "",
    type: "personal",
    kind,
    href,
    audienceLabel:
      kind === "salary_advance"
        ? "Salary advance"
        : kind === "payroll_created"
          ? "Payroll"
          : kind === "payslip_ready"
            ? "Payslip"
            : kind === "chat_message"
              ? "Chat"
              : "Personal",
    createdAt: n.createdAt,
    readAt: n.readAt || null,
  };
}

function mergeLists(announcements, personal) {
  return [...personal, ...announcements]
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    )
    .slice(0, 50);
}

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [readIds, setReadIds] = useState(() => loadReadIds());
  const [connected, setConnected] = useState(false);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

  const items = useMemo(() => {
    const merged = mergeLists(announcements, personal);
    // Hide anything already read / dismissed
    return merged.filter((i) => {
      if (i.readAt) return false;
      return !readIds.has(String(i.id));
    });
  }, [announcements, personal, readIds]);

  const fetchRecent = useCallback(async () => {
    if (!token) return;
    try {
      const [annRes, noteRes] = await Promise.all([
        axios.get(`${API_URL}/api/events/announcements/recent`, {
          params: { limit: 25 },
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/notifications/me`, {
          params: { limit: 40 },
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const reads = loadReadIds();
      setAnnouncements(
        (annRes.data?.data || [])
          .map(mapAnnouncement)
          .filter((a) => !reads.has(String(a.id)))
      );
      setPersonal((noteRes.data?.data || []).map(mapPersonal));
      setReadIds(reads);
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setAnnouncements([]);
      setPersonal([]);
      setConnected(false);
      return;
    }

    fetchRecent();

    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("announcement:new", (payload) => {
      const next = mapAnnouncement({
        ...payload,
        _id: payload.id || payload._id,
      });
      setAnnouncements((prev) =>
        [next, ...prev.filter((p) => p.id !== next.id)].slice(0, 40)
      );
      if (payload.type === "announcement") {
        toast.info(`New announcement: ${payload.title}`, { autoClose: 6000 });
      }
    });

    socket.on("notify:personal", (payload) => {
      const next = mapPersonal(payload);
      setPersonal((prev) =>
        [next, ...prev.filter((p) => p.id !== next.id)].slice(0, 40)
      );
      toast.info(next.title, { autoClose: 7000 });
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, token, fetchRecent, user?._id || user?.id]);

  const unreadCount = useMemo(() => items.length, [items]);

  const markRead = useCallback(
    async (id) => {
      const sid = String(id);
      setReadIds((prev) => {
        const next = new Set(prev);
        next.add(sid);
        saveReadIds(next);
        return next;
      });
      // Remove from inbox immediately
      setPersonal((prev) => prev.filter((p) => String(p.id) !== sid));
      setAnnouncements((prev) => prev.filter((p) => String(p.id) !== sid));

      if (token && /^[0-9a-fA-F]{24}$/.test(sid)) {
        try {
          await axios.patch(
            `${API_URL}/api/notifications/${sid}/read`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch {
          /* announcements use local ids — ignore */
        }
      }
    },
    [token]
  );

  const markAllRead = useCallback(async () => {
    const ids = items.map((i) => String(i.id));
    setReadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      saveReadIds(next);
      return next;
    });
    setPersonal([]);
    setAnnouncements([]);
    if (token) {
      try {
        await axios.patch(
          `${API_URL}/api/notifications/me/read-all`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (err) {
        console.error("mark all read failed", err);
      }
    }
  }, [items, token]);

  const value = {
    items,
    unreadCount,
    connected,
    markRead,
    markAllRead,
    refresh: fetchRecent,
    isRead: (id) => {
      return readIds.has(String(id));
    },
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
