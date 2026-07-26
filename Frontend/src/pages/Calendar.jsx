import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Megaphone,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
import { useNotifications } from "../contexts/NotificationContext";

const API_URL = import.meta.env.VITE_API_URL;

const EVENT_TYPES = [
  { value: "announcement", label: "Announcement", color: "bg-amber-500" },
  { value: "meeting", label: "Meeting", color: "bg-primary" },
  { value: "holiday", label: "Holiday", color: "bg-red-500" },
  { value: "training", label: "Training", color: "bg-purple-500" },
  { value: "personal", label: "Personal", color: "bg-green-500" },
  { value: "other", label: "Other", color: "bg-gray-500" },
];

function toYMD(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalYMD(ymd) {
  if (!ymd || typeof ymd !== "string") return new Date();
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(ymd);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function emptyForm() {
  return {
    title: "",
    description: "",
    date: toYMD(new Date()),
    time: "09:00",
    duration: "60",
    type: "announcement",
    location: "",
    attendees: [],
  };
}

function transformEvent(e) {
  const createdByRaw = e.createdBy;
  const createdBy =
    createdByRaw == null
      ? null
      : typeof createdByRaw === "object"
        ? String(createdByRaw._id || createdByRaw.id || "")
        : String(createdByRaw);

  return {
    id: e._id || e.id,
    title: e.title,
    description: e.description || "",
    date: toYMD(e.date),
    time: e.time || "09:00",
    duration: e.duration,
    type: e.type || "other",
    location: e.location || "",
    attendees: Array.isArray(e.attendees) ? e.attendees : [],
    color: e.color || "bg-gray-500",
    visibilityScope: e.visibilityScope || "organization",
    audienceLabel: e.audienceLabel || null,
    createdBy: createdBy || null,
  };
}

function scopeBadgeLabel(scope) {
  if (scope === "organization") return "Organization";
  if (scope === "sector") return "Sector";
  if (scope === "sub_sector") return "Sub-sector";
  if (scope === "sub_sub_sector") return "Unit";
  return "Team";
}

function sortEvents(list) {
  return [...list].sort((a, b) => {
    const byDate = (a.date || "").localeCompare(b.date || "");
    if (byDate !== 0) return byDate;
    return (a.time || "").localeCompare(b.time || "");
  });
}

function formatTime(time) {
  if (!time || time === "all-day") return "All Day";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return time;
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes || "00"} ${ampm}`;
}

function tomorrowYMD() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toYMD(d);
}

function badgeVariant(type) {
  const variants = {
    announcement: "default",
    meeting: "secondary",
    holiday: "destructive",
    training: "secondary",
    personal: "outline",
  };
  return variants[type] || "outline";
}

const Calendar = () => {
  const { t } = useLanguage();
  const {
    user,
    canManageHrOps,
    canManage,
    isManager,
    isUnitManager,
    isSectorLead,
    isOrgWide,
    isAdmin,
    isSuperAdmin,
    roleLabel,
  } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const canPost = canManage; // Manager+
  const canOverrideEvents = isSuperAdmin || isAdmin;
  const currentUserId = String(user?._id || user?.id || "");
  const canMutateEvent = (event) => {
    if (canOverrideEvents) return true;
    if (!event?.createdBy || !currentUserId) return false;
    return String(event.createdBy) === currentUserId;
  };
  const managerOnlyAnnouncement = (isManager || isUnitManager) && !canManageHrOps;
  const postAudienceHint = isOrgWide
    ? "Visible organization-wide (all sectors)"
    : isSectorLead
      ? "Visible to everyone in your sector"
      : isUnitManager
        ? "Visible only to your nested unit"
        : isManager
          ? "Visible only to your sub-sector"
          : "";
  const availableTypes = managerOnlyAnnouncement
    ? EVENT_TYPES.filter((t) => t.value === "announcement")
    : EVENT_TYPES;

  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [newEvent, setNewEvent] = useState(emptyForm);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [events, setEvents] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [dayEvents, setDayEvents] = useState([]);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // From dashboard event click: focus that day without changing calendar list behavior
  useEffect(() => {
    const key = location.state?.selectedDate;
    if (!key || typeof key !== "string") return;
    const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isNaN(d.getTime())) setSelectedDate(d);
  }, [location.state]);

  const API_BASE = API_URL;
  const token =
    typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

  const monthRange = useMemo(() => {
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    return { from: toYMD(start), to: toYMD(end) };
  }, [selectedDate]);

  // Debounce search so typing stays instant
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchMonthEvents = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingMonth(true);
      const res = await axios.get(`${API_BASE}/api/events`, {
        params: { from: monthRange.from, to: monthRange.to },
        headers: { Authorization: `Bearer ${token}` },
      });
      setEvents(sortEvents((res.data?.data || []).map(transformEvent)));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to load events");
    } finally {
      setLoadingMonth(false);
    }
  }, [API_BASE, monthRange.from, monthRange.to, token]);

  const fetchUpcoming = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingUpcoming(true);
      const res = await axios.get(`${API_BASE}/api/events/upcoming`, {
        params: { limit: 8 },
        headers: { Authorization: `Bearer ${token}` },
      });
      setUpcoming(sortEvents((res.data?.data || []).map(transformEvent)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUpcoming(false);
    }
  }, [API_BASE, token]);

  const fetchDayEvents = useCallback(async () => {
    if (!token || !selectedDate) return;
    try {
      setLoadingDay(true);
      const day = toYMD(selectedDate);
      const res = await axios.get(`${API_BASE}/api/events/date/${day}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDayEvents(sortEvents((res.data?.data || []).map(transformEvent)));
    } catch (err) {
      console.error(err);
      setDayEvents([]);
    } finally {
      setLoadingDay(false);
    }
  }, [API_BASE, token, selectedDate]);

  useEffect(() => {
    fetchMonthEvents();
  }, [fetchMonthEvents]);

  useEffect(() => {
    fetchUpcoming();
  }, [fetchUpcoming]);

  useEffect(() => {
    fetchDayEvents();
  }, [fetchDayEvents]);

  const filteredEvents = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return events.filter((event) => {
      const matchesSearch =
        !q ||
        event.title.toLowerCase().includes(q) ||
        event.description.toLowerCase().includes(q) ||
        (event.location || "").toLowerCase().includes(q);
      const matchesType = filterType === "all" || event.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [events, debouncedSearch, filterType]);

  const selectedDayVisible = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return dayEvents.filter((event) => {
      const matchesSearch =
        !q ||
        event.title.toLowerCase().includes(q) ||
        event.description.toLowerCase().includes(q) ||
        (event.location || "").toLowerCase().includes(q);
      const matchesType = filterType === "all" || event.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [dayEvents, debouncedSearch, filterType]);

  const upcomingVisible = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const tomorrow = tomorrowYMD();
    return upcoming
      .filter((event) => event.date >= tomorrow)
      .filter((event) => {
        const matchesSearch =
          !q ||
          event.title.toLowerCase().includes(q) ||
          event.description.toLowerCase().includes(q);
        const matchesType = filterType === "all" || event.type === filterType;
        return matchesSearch && matchesType;
      });
  }, [upcoming, debouncedSearch, filterType]);

  const eventDatesSet = useMemo(() => {
    return new Set(filteredEvents.map((e) => e.date));
  }, [filteredEvents]);

  const selectedDayKey = toYMD(selectedDate);

  const syncListsAfterChange = (item, { remove = false, dayKey } = {}) => {
    const tomorrow = tomorrowYMD();
    const selectedKey = dayKey || toYMD(selectedDate);

    if (remove) {
      const id = item.id || item;
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setUpcoming((prev) => prev.filter((e) => e.id !== id));
      setDayEvents((prev) => prev.filter((e) => e.id !== id));
      return;
    }

    setEvents((prev) =>
      sortEvents([item, ...prev.filter((e) => e.id !== item.id)])
    );

    if (item.date === selectedKey) {
      setDayEvents((prev) =>
        sortEvents([item, ...prev.filter((e) => e.id !== item.id)])
      );
    }

    if (item.date >= tomorrow) {
      setUpcoming((prev) =>
        sortEvents([item, ...prev.filter((e) => e.id !== item.id)]).slice(0, 8)
      );
    } else {
      setUpcoming((prev) => prev.filter((e) => e.id !== item.id));
    }
  };

  const handleAddEvent = async () => {
    if (!newEvent.title?.trim() || !newEvent.date) {
      toast.error("Please fill in title and date");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: newEvent.title.trim(),
        description: newEvent.description,
        date: newEvent.date,
        time: newEvent.time || "09:00",
        duration: newEvent.duration ? Number(newEvent.duration) : 60,
        type: newEvent.type,
        location: newEvent.location,
        attendees: newEvent.attendees || [],
      };

      const res = await axios.post(`${API_BASE}/api/events`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const createdRaw = res.data?.data;
      if (!createdRaw) throw new Error("No event returned");

      const created = transformEvent(createdRaw);
      setSelectedDate(parseLocalYMD(created.date));
      syncListsAfterChange(created, { dayKey: created.date });
      setNewEvent(emptyForm());
      setShowEventDialog(false);
      refreshNotifications();

      const label =
        created.type === "announcement" ? "Announcement" : "Event";
      const audience =
        createdRaw.audienceLabel ||
        scopeBadgeLabel(created.visibilityScope);
      toast.success(`${label} posted — ${audience}`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to add event");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (event) => {
    setEditingEvent({
      id: event.id,
      title: event.title,
      description: event.description || "",
      date: event.date,
      time: event.time || "09:00",
      duration: String(event.duration || 60),
      type: event.type || "announcement",
      location: event.location || "",
    });
    setShowEditDialog(true);
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent?.id || !editingEvent.title?.trim() || !editingEvent.date) {
      toast.error("Please fill in title and date");
      return;
    }
    if (managerOnlyAnnouncement && editingEvent.type !== "announcement") {
      toast.error("Managers can only manage announcements");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: editingEvent.title.trim(),
        description: editingEvent.description,
        date: editingEvent.date,
        time: editingEvent.time || "09:00",
        duration: editingEvent.duration ? Number(editingEvent.duration) : 60,
        type: editingEvent.type,
        location: editingEvent.location,
      };

      const res = await axios.put(
        `${API_BASE}/api/events/${editingEvent.id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updatedRaw = res.data?.data;
      if (!updatedRaw) throw new Error("No event returned");

      const updated = transformEvent(updatedRaw);
      setSelectedDate(parseLocalYMD(updated.date));
      syncListsAfterChange(updated, { dayKey: updated.date });
      setShowEditDialog(false);
      setEditingEvent(null);
      refreshNotifications();
      toast.success("Event updated");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update event");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this event?")) return;
    try {
      setDeletingId(id);
      await axios.delete(`${API_BASE}/api/events/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      syncListsAfterChange({ id }, { remove: true });
      refreshNotifications();
      toast.success("Event removed");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const EventCard = ({ event, showDate = false, onOpen }) => {
    const isPast = event.date < toYMD(new Date());
    return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      className={`p-3 border rounded-lg space-y-2 bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-sm ${
        onOpen ? "cursor-pointer" : ""
      } ${isPast ? "opacity-90" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {event.type === "announcement" && (
            <Megaphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          )}
          <h4 className="font-semibold text-sm leading-snug">{event.title}</h4>
        </div>
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          {isPast && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Past
            </Badge>
          )}
          <Badge variant={badgeVariant(event.type)} className="text-xs capitalize">
            {event.type}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {scopeBadgeLabel(event.visibilityScope)}
          </Badge>
          {canMutateEvent(event) && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(event);
                }}
                aria-label="Edit event"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                disabled={deletingId === event.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(event.id);
                }}
                aria-label="Delete event"
              >
                {deletingId === event.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>
      {event.description && (
        <p className="text-sm text-muted-foreground line-clamp-3">
          {event.description}
        </p>
      )}
      <div className="space-y-1 text-xs text-muted-foreground">
        {showDate && (
          <div className="flex items-center">
            <CalendarIcon className="w-3 h-3 mr-1" />
            {parseLocalYMD(event.date).toLocaleDateString()}
          </div>
        )}
        <div className="flex items-center">
          <Clock className="w-3 h-3 mr-1" />
          {formatTime(event.time)}
          {event.duration && event.time !== "all-day" && (
            <span> ({event.duration} min)</span>
          )}
        </div>
        {event.location && (
          <div className="flex items-center">
            <MapPin className="w-3 h-3 mr-1" />
            {event.location}
          </div>
        )}
        {event.attendees.length > 0 && (
          <div className="flex items-center">
            <Users className="w-3 h-3 mr-1" />
            {event.attendees.length} attendees
          </div>
        )}
      </div>
    </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('pages.calendar')}</h1>
          <p className="text-muted-foreground">{t('pages.calendarDesc')}</p>
        </div>
        {canPost && (
          <Dialog
            open={showEventDialog}
            onOpenChange={(open) => {
              setShowEventDialog(open);
              if (open && managerOnlyAnnouncement) {
                setNewEvent((prev) => ({ ...prev, type: "announcement" }));
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="btn-gradient w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Post Event / Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Post to Calendar</DialogTitle>
                <DialogDescription>
                  {postAudienceHint ||
                    "Announcements appear for the people in your scope."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {postAudienceHint && (
                  <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                    Audience: <strong>{postAudienceHint}</strong>
                    {roleLabel ? ` (${roleLabel})` : ""}
                  </div>
                )}
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={newEvent.type}
                    onValueChange={(value) =>
                      setNewEvent({ ...newEvent, type: value })
                    }
                    disabled={managerOnlyAnnouncement}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder={
                      newEvent.type === "announcement"
                        ? "Announcement title"
                        : "Event title"
                    }
                    value={newEvent.title}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Details…"
                    value={newEvent.description}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newEvent.date}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={newEvent.time}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, time: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      placeholder="60"
                      value={newEvent.duration}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, duration: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="Room, Zoom, office…"
                      value={newEvent.location}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, location: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowEventDialog(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddEvent}
                  className="btn-gradient"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Posting…
                    </>
                  ) : newEvent.type === "announcement" ? (
                    "Post Announcement"
                  ) : (
                    "Add Event"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="dashboard-card">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search announcements & events…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center">
                  <CalendarIcon className="w-5 h-5 mr-2" />
                  {selectedDate.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const d = new Date(selectedDate);
                      d.setMonth(d.getMonth() - 1);
                      setSelectedDate(d);
                    }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const d = new Date(selectedDate);
                      d.setMonth(d.getMonth() + 1);
                      setSelectedDate(d);
                    }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Days with events are highlighted. Click a day to see details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                month={selectedDate}
                onMonthChange={setSelectedDate}
                className="rounded-md border w-full"
                modifiers={{
                  hasEvents: (date) => eventDatesSet.has(toYMD(date)),
                }}
                modifiersClassNames={{
                  hasEvents:
                    "bg-primary/15 font-semibold ring-1 ring-primary/30",
                }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="dashboard-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </CardTitle>
              <CardDescription>
                {selectedDayKey === toYMD(new Date())
                  ? "Today — announcements and events on this day"
                  : "Events & announcements on the selected day"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {loadingDay ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading…
                  </div>
                ) : selectedDayVisible.length > 0 ? (
                  selectedDayVisible.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-6">
                    No events on this date
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="dashboard-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                Upcoming
              </CardTitle>
              <CardDescription>
                From tomorrow onward — click a past/current day above to review
                that date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {loadingUpcoming && upcoming.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading…
                  </div>
                ) : upcomingVisible.length > 0 ? (
                  upcomingVisible.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      showDate
                      onOpen={() => setSelectedDate(parseLocalYMD(event.date))}
                    />
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-6">
                    Nothing from tomorrow onward
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) setEditingEvent(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit event</DialogTitle>
            <DialogDescription>
              Update details for this calendar item.
            </DialogDescription>
          </DialogHeader>
          {editingEvent && (
            <div className="space-y-4">
              <div>
                <Label>Type</Label>
                <Select
                  value={editingEvent.type}
                  onValueChange={(value) =>
                    setEditingEvent({ ...editingEvent, type: value })
                  }
                  disabled={managerOnlyAnnouncement}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title *</Label>
                <Input
                  value={editingEvent.title}
                  onChange={(e) =>
                    setEditingEvent({ ...editingEvent, title: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editingEvent.description}
                  onChange={(e) =>
                    setEditingEvent({
                      ...editingEvent,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={editingEvent.date}
                    onChange={(e) =>
                      setEditingEvent({ ...editingEvent, date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={editingEvent.time}
                    onChange={(e) =>
                      setEditingEvent({ ...editingEvent, time: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={editingEvent.duration}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        duration: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    value={editingEvent.location}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        location: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  className="btn-gradient"
                  onClick={handleUpdateEvent}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calendar;
