import { useAuth } from '../contexts/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCard } from '../components/dashboard/StatCard';
import { DashboardModeHero, DashboardQuickActions } from '../components/dashboard/DashboardModePanels';
import { getDashboardModeConfig } from '../utils/dashboardModes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import {
  Users, UserCheck, DollarSign, Calendar, TrendingUp, TrendingDown,
  Clock, Building2, Bell, Target, Award, Activity
} from 'lucide-react';
import { useClientPagination } from '../hooks/useClientPagination';
import ListPagination from '../components/ListPagination';
const API_URL = import.meta.env.VITE_API_URL;

/** Match Salary page: only approved/paid nets count toward payroll totals */
function isCountablePayroll(p) {
  return p && ["approved", "paid"].includes(String(p.status || "").toLowerCase());
}

function payrollMonthKeyOf(p) {
  if (p?.payrollMonth) return String(p.payrollMonth);
  const pd = p?.payDate ? new Date(p.payDate) : null;
  if (!pd || Number.isNaN(pd.getTime())) return null;
  return `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, "0")}`;
}

function formatEtb(v) {
  return `${Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ETB`;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonthKey(key = currentMonthKey()) {
  const [y, m] = String(key || "").split("-").map(Number);
  if (!y || !m) return null;
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(key) {
  const [y, m] = String(key || "").split("-").map(Number);
  if (!y || !m) return key || "";
  return new Date(y, m - 1, 1).toLocaleString(undefined, {
    month: "short",
    year: "numeric",
  });
}

/** Inclusive leave days that fall inside calendar month YYYY-MM. */
function leaveDaysInMonth(leave, monthKey) {
  const [y, m] = String(monthKey || "").split("-").map(Number);
  if (!y || !m) return Number(leave?.days) || 0;
  const start = new Date(leave.startDate);
  const end = new Date(leave.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }
  const monthStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
  const from = start > monthStart ? start : monthStart;
  const to = end < monthEnd ? end : monthEnd;
  if (to < from) return 0;
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toDay - fromDay) / (1000 * 60 * 60 * 24)) + 1;
}

/** Build a real delta for StatCard. Returns { change, trend }. */
function buildDelta(current, previous, { decimals = 0, suffix = "", invertGood = false } = {}) {
  if (current == null || previous == null) {
    return { change: null, trend: "neutral" };
  }
  const cur = Number(current);
  const prev = Number(previous);
  if (Number.isNaN(cur) || Number.isNaN(prev)) {
    return { change: null, trend: "neutral" };
  }
  const diff = cur - prev;
  const threshold = decimals > 0 ? 0.05 : 0.5;
  if (Math.abs(diff) < threshold) {
    return { change: `0${suffix}`, trend: "neutral" };
  }
  const sign = diff > 0 ? "+" : "";
  const formatted = `${sign}${decimals > 0 ? diff.toFixed(decimals) : Math.round(diff)}${suffix}`;
  let trend = "neutral";
  if (diff > 0) trend = invertGood ? "down" : "up";
  if (diff < 0) trend = invertGood ? "up" : "down";
  return { change: formatted, trend };
}

function buildPercentDelta(current, previous, { invertGood = false } = {}) {
  if (current == null || previous == null) {
    return { change: null, trend: "neutral" };
  }
  const cur = Number(current);
  const prev = Number(previous);
  if (Number.isNaN(cur) || Number.isNaN(prev)) {
    return { change: null, trend: "neutral" };
  }
  if (prev === 0) {
    if (cur === 0) return { change: "0%", trend: "neutral" };
    return { change: "+100%", trend: invertGood ? "down" : "up" };
  }
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) < 0.5) return { change: "0%", trend: "neutral" };
  const sign = pct > 0 ? "+" : "";
  return {
    change: `${sign}${Math.round(pct)}%`,
    trend: pct > 0 ? (invertGood ? "down" : "up") : invertGood ? "up" : "down",
  };
}

function localYmd(d = new Date()) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

/** Employment status only — leave requests do not change this. */
function isActiveEmployee(emp) {
  return String(emp?.status || "active").toLowerCase() === "active";
}

/** Org-tree path only — never legacy Department names */
function unitPathParts(emp) {
  return String(emp?.unitPath || "")
    .split(" › ")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toId(val) {
  if (!val) return null;
  if (typeof val === "object") return String(val._id || val.id || "") || null;
  return String(val);
}

function isOrgWideEmployee(emp) {
  return (
    emp?.role === "superadmin" ||
    emp?.role === "admin" ||
    emp?.role === "hr" ||
    emp?.scopeLevel === "organization"
  );
}

/** Flatten sector tree / list into id → { name, level } */
function indexSectorNodes(nodes, map = {}) {
  for (const n of nodes || []) {
    const id = toId(n._id || n.id);
    if (id) {
      map[id] = {
        name: n.name || "Unknown",
        level: n.level,
      };
    }
    if (Array.isArray(n.children) && n.children.length) {
      indexSectorNodes(n.children, map);
    }
  }
  return map;
}

/**
 * Group at one hierarchy level using Sector ids (not department labels).
 * Returns null to exclude from the current level chart.
 */
function distributionBucket(emp, level, sectorById = {}) {
  if (level === "sector") {
    if (isOrgWideEmployee(emp) && !emp?.sectorId) return "Organization";
    const sid = toId(emp?.sectorId);
    if (sid && sectorById[sid]) return sectorById[sid].name;
    // Fallback: top path label only when employee is sector-linked
    if (sid) {
      const parts = unitPathParts(emp);
      return parts[0] || "Unassigned";
    }
    return "Unassigned";
  }

  if (level === "sub_sector") {
    const id = toId(emp?.subSectorId);
    if (id && sectorById[id]) return sectorById[id].name;
    const parts = unitPathParts(emp);
    if (parts.length >= 2) return parts[1];
    return null;
  }

  // unit (sub-sub-sector)
  const id = toId(emp?.subSubSectorId);
  if (id && sectorById[id]) return sectorById[id].name;
  const parts = unitPathParts(emp);
  if (parts.length >= 3) return parts[2];
  return null;
}

function defaultDistributionLevel(modeId) {
  if (modeId === "manager" || modeId === "unit_manager") return "unit";
  if (modeId === "sector_lead") return "sub_sector";
  return "sector"; // superadmin, admin, hr
}

function distributionLevelOptions(modeId) {
  if (modeId === "superadmin" || modeId === "admin" || modeId === "hr") {
    return [
      { id: "sector", label: "Sectors" },
      { id: "sub_sector", label: "Sub-sectors" },
      { id: "unit", label: "Units" },
    ];
  }
  if (modeId === "sector_lead") {
    return [
      { id: "sub_sector", label: "Sub-sectors" },
      { id: "unit", label: "Units" },
    ];
  }
  return [{ id: "unit", label: "Units" }];
}

function colorForLabel(name) {
  let hash = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 65% 48%)`;
}

function buildDistributionData(employees, level, sectorById) {
  const counts = {};
  let skipped = 0;
  for (const emp of employees || []) {
    const bucket = distributionBucket(emp, level, sectorById);
    if (!bucket) {
      skipped += 1;
      continue;
    }
    counts[bucket] = (counts[bucket] || 0) + 1;
  }
  const data = Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
    .map((name) => ({
      name,
      value: counts[name],
      color: colorForLabel(name),
    }));
  return { data, skipped };
}

const Dashboard = () => {

  const wrapperStyle = {
    paddingBottom: "20px",
    marginTop: "20px"
  };

  const weeklyAttendanceContainerStyle = {
    marginBottom: "20px"
  };

  const recentActivities = {
    marginBottom: "20px"
  }

  const marginStyle = {
    marginBottom: "20px"
  };

  const auth = useAuth();
  const { user, isSuperAdmin, scopeLevel, canAccessAdminConsole } = auth;
  const mode = getDashboardModeConfig(user);
  const manageView = mode.showTeamKpis;
  const navigate = useNavigate();
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, total: 0, late: 0, leave: 0 });
  const [totalEmployees, setTotalEmployees] = useState(null);
  const [scopedEmployees, setScopedEmployees] = useState([]);
  const [sectorById, setSectorById] = useState({});
  const [distributionLevel, setDistributionLevel] = useState(() =>
    defaultDistributionLevel(mode?.id)
  );

  const scopeLabel = (() => {
    if (isSuperAdmin || user?.scopeLevel === 'organization') return 'Organization-wide';
    const unit =
      user?.subSubSectorId?.pathNames?.join(' › ') ||
      user?.subSectorId?.pathNames?.join(' › ') ||
      user?.sectorId?.pathNames?.join(' › ') ||
      user?.unitPath ||
      null;
    if (unit) return unit;
    if (scopeLevel) return `Scope: ${String(scopeLevel).replaceAll('_', ' ')}`;
    return manageView ? 'Management scope' : 'Personal';
  })();

  const modeAuthCaps = { canAccessAdminConsole };

  const API_BASE = API_URL;
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const formatEvent = (e) => {
    try {
      // Format date as local date, and append time if available
      const d = new Date(e.date);
      const dateText = isNaN(d.getTime())
        ? String(e.date)
        : `${d.toLocaleDateString()}${e.time ? `, ${e.time}` : ''}`;
      const dateKey = !isNaN(d.getTime())
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : null;
      return {
        id: e._id || e.id,
        title: e.title,
        type: e.type || 'meeting',
        date: dateText,
        dateKey,
      };
    } catch {
      return { id: e._id || e.id, title: e.title, type: e.type || 'meeting', date: String(e.date), dateKey: null };
    }
  };

  const openEventInCalendar = (event) => {
    navigate('/calendar', {
      state: event?.dateKey ? { selectedDate: event.dateKey } : undefined,
    });
  };

  const fetchUpcoming = async () => {
    if (!token) return;
    setLoadingEvents(true);
    try {
      const today = new Date();
      const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const headers = { Authorization: `Bearer ${token}` };

      // Dashboard only: today + upcoming (calendar page still uses /upcoming alone)
      const [todayRes, upcomingRes] = await Promise.all([
        axios.get(`${API_BASE}/api/events/date/${ymd}`, { headers }),
        axios.get(`${API_BASE}/api/events/upcoming`, {
          params: { limit: 8 },
          headers,
        }),
      ]);

      const todayItems = Array.isArray(todayRes.data?.data) ? todayRes.data.data : [];
      const upcomingItems = Array.isArray(upcomingRes.data?.data)
        ? upcomingRes.data.data
        : [];

      const byId = new Map();
      for (const e of [...todayItems, ...upcomingItems]) {
        const id = String(e._id || e.id);
        if (!id || byId.has(id)) continue;
        byId.set(id, e);
      }

      const merged = Array.from(byId.values()).sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (da !== db) return da - db;
        return String(a.time || "").localeCompare(String(b.time || ""));
      });

      setUpcomingEvents(merged.slice(0, 8).map(formatEvent));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to load upcoming events');
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchUpcoming();
    fetchActivities();
    // fetch today's attendance stats (+ vs yesterday)
    const fetchStats = async () => {
      if (!token) return;
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const ymdYesterday = localYmd(yesterday);
        const headers = { Authorization: `Bearer ${token}` };

        const [todayRes, yRes] = await Promise.all([
          axios.get(`${API_BASE}/api/attendance/stats`, { headers }),
          axios.get(`${API_BASE}/api/attendance/stats`, {
            params: { date: ymdYesterday },
            headers,
          }),
        ]);

        const s = todayRes.data?.stats || {};
        const y = yRes.data?.stats || {};
        const presentToday = (Number(s.present) || 0) + (Number(s.late) || 0);
        const absentToday = Number(s.absent) || 0;
        const presentYday = (Number(y.present) || 0) + (Number(y.late) || 0);
        const absentYday = Number(y.absent) || 0;

        setAttendanceStats({ ...s, present: presentToday, absent: absentToday });
        setPresentMoM(buildDelta(presentToday, presentYday));
        setAbsentMoM(buildDelta(absentToday, absentYday, { invertGood: true }));
      } catch (err) {
        console.error('Failed to load attendance stats', err);
      }
    };
    fetchStats();
    // fetch total employees count
    const fetchTotalEmployees = async () => {
      if (!token) return;
      try {
        const res = await axios.get(`${API_BASE}/api/employees`, { headers: { Authorization: `Bearer ${token}` } });
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        // Active employment status only (pending leave does not make someone inactive)
        setTotalEmployees(list.filter(isActiveEmployee).length);
      } catch (err) {
        console.error('Failed to load total employees', err);
      }
    };
    fetchTotalEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Weekly attendance (will be loaded from API)
  const [attendanceData, setAttendanceData] = useState([
    { name: 'Mon', present: 0, absent: 0 },
    { name: 'Tue', present: 0, absent: 0 },
    { name: 'Wed', present: 0, absent: 0 },
    { name: 'Thu', present: 0, absent: 0 },
    { name: 'Fri', present: 0, absent: 0 },
  ]);

  // Salary progression data (last 6 months). Will be loaded from the backend payrolls.
  const [salaryData, setSalaryData] = useState(() => {
    const arr = [];
    const now = new Date();
    // initialize last 6 months with zero amounts
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push({ month: d.toLocaleString('default', { month: 'short' }), amount: 0 });
    }
    return arr;
  });

  const [payrollThisMonth, setPayrollThisMonth] = useState(null);
  const [payrollMoM, setPayrollMoM] = useState({ change: null, trend: "neutral" });
  const [pendingRequestsCount, setPendingRequestsCount] = useState(null);
  const [presentMoM, setPresentMoM] = useState({ change: null, trend: "neutral" });
  const [absentMoM, setAbsentMoM] = useState({ change: null, trend: "neutral" });
  // Employee personal stats
  const [hoursThisWeek, setHoursThisWeek] = useState(null);
  const [hoursWoW, setHoursWoW] = useState({ change: null, trend: "neutral" });
  const [attendanceRateUser, setAttendanceRateUser] = useState(null);
  const [attendanceRateWoW, setAttendanceRateWoW] = useState({ change: null, trend: "neutral" });
  const [currentSalary, setCurrentSalary] = useState(null);
  const [netPayDelta, setNetPayDelta] = useState({ change: null, trend: "neutral" });
  const [leaveBalanceDays, setLeaveBalanceDays] = useState(null);
  const [leaveMoM, setLeaveMoM] = useState({ change: null, trend: "neutral" });
  const [leavePendingMine, setLeavePendingMine] = useState(null);
  const [salaryDebug, setSalaryDebug] = useState(null);
  const [showSalaryDebug, setShowSalaryDebug] = useState(false);

  const thisMonthKey = useMemo(() => currentMonthKey(), []);
  const thisMonthLabel = useMemo(
    () => monthLabelFromKey(thisMonthKey),
    [thisMonthKey]
  );

  const distributionOptions = distributionLevelOptions(mode.id);
  const distributionBuilt = useMemo(
    () => buildDistributionData(scopedEmployees, distributionLevel, sectorById),
    [scopedEmployees, distributionLevel, sectorById]
  );
  const departmentData = distributionBuilt.data;
  const distributionSkipped = distributionBuilt.skipped;

  useEffect(() => {
    setDistributionLevel(defaultDistributionLevel(mode.id));
  }, [mode.id]);

  useEffect(() => {
    // Fetch weekly attendance for last 5 weekdays and replace mock
    const fetchWeeklyAttendance = async () => {
      if (!token) return;
      try {
        // build last 5 weekdays (Mon-Fri). Start from today and walk backwards.
        const days = [];
        const today = new Date();
        let d = new Date(today);
        // collect 5 weekdays
        while (days.length < 5) {
          const dayOfWeek = d.getDay(); // 0 Sun .. 6 Sat
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            // clone date
            days.push(new Date(d));
          }
          d.setDate(d.getDate() - 1);
        }

        // days[] currently is [today-or-most-recent-weekday, ..., older]
        // we want oldest -> newest for chart (Mon..Fri)
        days.reverse();

        const results = await Promise.all(days.map(async (dt) => {
          const iso = dt.toISOString().slice(0, 10);
          try {
            const res = await axios.get(`${API_BASE}/api/attendance/stats`, {
              params: { date: iso },
              headers: { Authorization: `Bearer ${token}` },
            });
            const stats = res.data?.stats || { present: 0, absent: 0 };
            return { date: dt, stats };
          } catch (e) {
            console.error('weekly attendance fetch failed for', iso, e);
            return { date: dt, stats: { present: 0, absent: 0 } };
          }
        }));

        // Map to names (Mon..Fri) and values
        const mapped = results.map(({ date: dt, stats }) => {
          const name = dt.toLocaleDateString(undefined, { weekday: 'short' });
          const presentWithLate = (Number(stats.present) || 0) + (Number(stats.late) || 0);
          return { name, present: presentWithLate, absent: Number(stats.absent) || 0 };
        });

        setAttendanceData(mapped);
      } catch (err) {
        console.error('Failed to load weekly attendance', err);
      }
    };

    fetchWeeklyAttendance();

    const fetchDepartments = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [empRes, sectorRes] = await Promise.all([
          axios.get(`${API_BASE}/api/employees`, { headers }),
          axios.get(`${API_BASE}/api/sectors/tree`, { headers }),
        ]);
        const employees = Array.isArray(empRes.data?.data) ? empRes.data.data : [];
        setScopedEmployees(employees.filter(isActiveEmployee));
        setSectorById(indexSectorNodes(sectorRes.data?.data || []));
      } catch (err) {
        console.error('Failed to load department data', err);
        setScopedEmployees([]);
        setSectorById({});
      }
    };

    fetchDepartments();

    /** Scoped payroll list → this-month net (approved/paid) + 6-month progression */
    const fetchPayrollDashboard = async () => {
      if (!token) return;
      try {
        const payRes = await axios.get(`${API_BASE}/api/payroll`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payrolls = Array.isArray(payRes.data?.data) ? payRes.data.data : [];
        const countable = payrolls.filter(isCountablePayroll);

        const now = new Date();
        const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const lastMonthKey = previousMonthKey(thisMonthKey);
        const monthTotal = countable.reduce((sum, p) => {
          return payrollMonthKeyOf(p) === thisMonthKey
            ? sum + (Number(p.netSalary) || 0)
            : sum;
        }, 0);
        const lastMonthTotal = countable.reduce((sum, p) => {
          return payrollMonthKeyOf(p) === lastMonthKey
            ? sum + (Number(p.netSalary) || 0)
            : sum;
        }, 0);
        setPayrollThisMonth(monthTotal);
        setPayrollMoM(buildPercentDelta(monthTotal, lastMonthTotal));

        const monthsMap = new Map();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          monthsMap.set(key, {
            total: 0,
            label: d.toLocaleString("default", { month: "short" }),
          });
        }
        for (const p of countable) {
          const key = payrollMonthKeyOf(p);
          if (key && monthsMap.has(key)) {
            monthsMap.get(key).total += Number(p.netSalary || 0);
          }
        }
        setSalaryData(
          Array.from(monthsMap.values()).map((m) => ({
            month: m.label,
            amount: m.total,
          }))
        );

        // Personal dashboard: prefer latest approved/paid net over static employee.salary
        if (!manageView && countable.length) {
          const sorted = [...countable].sort((a, b) => {
            const da = new Date(a.payDate || a.payrollMonth || 0).getTime();
            const db = new Date(b.payDate || b.payrollMonth || 0).getTime();
            return db - da;
          });
          const latestNet = Number(sorted[0]?.netSalary);
          const prevNet = sorted[1] != null ? Number(sorted[1].netSalary) : null;
          if (!Number.isNaN(latestNet)) setCurrentSalary(latestNet);
          if (!Number.isNaN(latestNet) && prevNet != null && !Number.isNaN(prevNet)) {
            setNetPayDelta(buildPercentDelta(latestNet, prevNet));
          } else {
            setNetPayDelta({ change: null, trend: "neutral" });
          }
        }
      } catch (err) {
        console.error("Failed to load payrolls", err);
      }
    };

    const fetchPendingLeaveRequests = async () => {
      if (!token || !manageView) return;
      try {
        // All pending in scope — still needs review regardless of leave month
        const leaveRes = await axios.get(`${API_BASE}/api/leave`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const leaves = Array.isArray(leaveRes.data?.data) ? leaveRes.data.data : [];
        const pending = leaves.filter((l) => l.status === "pending").length;
        setPendingRequestsCount(pending);
      } catch (err) {
        console.error("Failed to load leave requests", err);
        setPendingRequestsCount(0);
      }
    };

    fetchPayrollDashboard();
    fetchPendingLeaveRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, manageView]);

  // Employee-specific data (hours this week, attendance rate, salary, leave balance)
  useEffect(() => {
    if (!token || !user || manageView) return;

    const parseWorkingMinutes = (s) => {
      if (!s || typeof s !== 'string') return 0;
      const m = s.match(/(\d+)h\s+(\d{1,2})m/);
      if (!m) return 0;
      const h = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      return (isNaN(h) || isNaN(mm)) ? 0 : (h * 60 + mm);
    };

    const getWeekBounds = (d) => {
      const date = new Date(d);
      const day = date.getDay(); // 0=Sun,1=Mon,...
      const diffToMonday = (day + 6) % 7; // days since Monday
      const start = new Date(date);
      start.setDate(date.getDate() - diffToMonday);
      start.setHours(0,0,0,0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23,59,59,999);
      return { start, end };
    };

    const weekStatsFromRecords = (records, start, endCap) => {
      const weekRecords = records.filter((r) => {
        const d = new Date(r.date);
        return d >= start && d <= endCap;
      });
      let totalDays = 0;
      const iter = new Date(start);
      while (iter <= endCap) {
        const wd = iter.getDay();
        if (wd >= 1 && wd <= 5) totalDays += 1;
        iter.setDate(iter.getDate() + 1);
      }
      const daysPresent = weekRecords.filter(
        (r) => r.status === "present" || r.status === "late"
      ).length;
      const totalMinutes = weekRecords.reduce(
        (acc, r) => acc + parseWorkingMinutes(r.workingHours || r.hours),
        0
      );
      const hours = totalMinutes / 60;
      const rate = totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0;
      return { hours, rate };
    };

    const fetchEmployeeStats = async () => {
      try {
        // attendance history for user
        const attRes = await axios.get(`${API_BASE}/api/attendance/me`, {
          params: { limit: 60 },
          headers: { Authorization: `Bearer ${token}` },
        });
        const records = Array.isArray(attRes.data?.data) ? attRes.data.data : [];

        const today = new Date();
        const { start, end } = getWeekBounds(today);
        const capEnd = new Date(Math.min(end.getTime(), today.getTime()));
        const thisWeek = weekStatsFromRecords(records, start, capEnd);

        const lastWeekStart = new Date(start);
        lastWeekStart.setDate(start.getDate() - 7);
        const lastWeekEnd = new Date(start);
        lastWeekEnd.setDate(start.getDate() - 1);
        lastWeekEnd.setHours(23, 59, 59, 999);
        const lastWeek = weekStatsFromRecords(records, lastWeekStart, lastWeekEnd);

        setHoursThisWeek(thisWeek.hours.toFixed(1));
        setAttendanceRateUser(`${thisWeek.rate}%`);
        setHoursWoW(buildDelta(thisWeek.hours, lastWeek.hours, { decimals: 1 }));
        setAttendanceRateWoW(buildDelta(thisWeek.rate, lastWeek.rate, { suffix: "%" }));

        // employee details for salary (defensive: API may return different shapes)
        try {
          const empId = user?.id || user?._id;
          if (empId) {
            const empRes = await axios.get(`${API_BASE}/api/employees/${empId}`, { headers: { Authorization: `Bearer ${token}` } });
            // store raw responses for easier debugging in the browser UI
            setSalaryDebug(prev => ({ ...prev, empRes: empRes.data }));
            console.debug('employee API response for', empId, empRes.data);
            // Common shapes: { data: { ...mappedEmployee } } or returned populated user object
            const possible = empRes.data?.data ?? empRes.data ?? {};
            // Salary might be number or string; prefer explicit number
            let salaryVal = (possible && (possible.salary ?? possible.data?.salary)) ?? user?.salary ?? null;
            // fallback: if still null, try listing employees and match by email or id
            if (salaryVal == null) {
              try {
                const allRes = await axios.get(`${API_BASE}/api/employees`, { headers: { Authorization: `Bearer ${token}` } });
                // store fallback list for debugging
                setSalaryDebug(prev => ({ ...prev, allRes: allRes.data }));
                const list = Array.isArray(allRes.data?.data) ? allRes.data.data : (Array.isArray(allRes.data) ? allRes.data : []);
                const found = list.find(e => String(e.id || e._id) === String(empId) || String(e.employeeId) === String(user?.employeeId) || (e.email && user?.email && e.email.toLowerCase() === user.email.toLowerCase()));
                if (found) {
                  console.debug('found employee in list fallback', found);
                  salaryVal = found.salary ?? found.data?.salary ?? null;
                }
              } catch (fe) {
                console.debug('fallback employees list fetch failed', fe);
              }
            }
            if (salaryVal == null) {
              console.debug('salary not found for user; empRes / user:', empRes.data, user);
            }
            setCurrentSalary((prev) =>
              prev != null ? prev : salaryVal != null ? Number(salaryVal) : null
            );
          } else {
            setCurrentSalary((prev) =>
              prev != null ? prev : user?.salary != null ? Number(user.salary) : null
            );
          }
        } catch (e) {
          console.error('Failed to fetch employee details', e);
          setCurrentSalary((prev) =>
            prev != null ? prev : user?.salary != null ? Number(user.salary) : null
          );
        }

        // Approved leave days this month vs last month
        try {
          const monthKey = thisMonthKey;
          const lastKey = previousMonthKey(monthKey);
          const headers = { Authorization: `Bearer ${token}` };
          const [thisRes, lastRes] = await Promise.all([
            axios.get(`${API_BASE}/api/leave`, { headers, params: { month: monthKey } }),
            axios.get(`${API_BASE}/api/leave`, { headers, params: { month: lastKey } }),
          ]);
          const thisLeaves = Array.isArray(thisRes.data?.data) ? thisRes.data.data : [];
          const lastLeaves = Array.isArray(lastRes.data?.data) ? lastRes.data.data : [];
          const approvedDays = thisLeaves
            .filter((l) => l.status === "approved")
            .reduce((s, l) => s + leaveDaysInMonth(l, monthKey), 0);
          const lastApprovedDays = lastLeaves
            .filter((l) => l.status === "approved")
            .reduce((s, l) => s + leaveDaysInMonth(l, lastKey), 0);
          const pendingMine = thisLeaves.filter((l) => l.status === "pending").length;
          setLeaveBalanceDays(approvedDays);
          setLeavePendingMine(pendingMine);
          setLeaveMoM(buildDelta(approvedDays, lastApprovedDays));
        } catch (e) {
          console.error("Failed to fetch leaves for employee", e);
          setLeaveBalanceDays(0);
          setLeavePendingMine(0);
          setLeaveMoM({ change: null, trend: "neutral" });
        }
      } catch (err) {
        console.error('Failed to load employee attendance', err);
      }
    };

    fetchEmployeeStats();
  }, [token, user, manageView, thisMonthKey]);

  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const fetchActivities = async (limit = 36) => {
    if (!token) return;
    setLoadingActivities(true);
    try {
      const params = { limit, days: 7 };
      // Employees: own feed. Managers+: backend scopes by org unit / role.
      if (!manageView) params.mine = true;
      const res = await axios.get(`${API_BASE}/api/activities`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setActivities(list);
    } catch (err) {
      console.error('Failed to load activities', err);
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  const activityPaging = useClientPagination(activities, 6, [
    activities.length,
    manageView,
  ]);

  // upcomingEvents now comes from API

  if (manageView) {
    return (
      <div className="container mx-auto p-6 space-y-8">
        <DashboardModeHero mode={mode} userName={user?.name} scopeLabel={scopeLabel} />
        <DashboardQuickActions mode={mode} authCaps={modeAuthCaps} />

        {/* Stats Grid — equal width/height cards */}
        <div
          style={wrapperStyle}
          className={`grid gap-4 mb-5 items-stretch grid-cols-1 sm:grid-cols-2 ${
            mode.showPayrollKpi ? 'xl:grid-cols-5 lg:grid-cols-3' : 'lg:grid-cols-4'
          }`}
        >
          <StatCard
            title={
              mode.id === 'manager' || mode.id === 'unit_manager'
                ? 'Active Team Size'
                : 'Active Employees'
            }
            value={totalEmployees !== null ? String(totalEmployees) : '0'}
            change="In your scope"
            showVsLastMonth={false}
            icon={Users}
            trend="neutral"
          />
          <StatCard
            title="Present Today"
            value={String(attendanceStats.present)}
            change={presentMoM.change}
            changeLabel="vs yesterday"
            showVsLastMonth={false}
            icon={UserCheck}
            trend={presentMoM.trend}
          />
          <StatCard
            title="Absent Today"
            value={String(attendanceStats.absent)}
            change={absentMoM.change}
            changeLabel="vs yesterday"
            showVsLastMonth={false}
            icon={Users}
            trend={absentMoM.trend}
          />
          {mode.showPayrollKpi && (
            <StatCard
              title="Net Payroll This Month"
              value={payrollThisMonth !== null ? formatEtb(payrollThisMonth) : formatEtb(0)}
              change={payrollMoM.change || "Approved / paid"}
              changeLabel={payrollMoM.change ? "vs last month" : null}
              showVsLastMonth={false}
              icon={DollarSign}
              trend={payrollMoM.change ? payrollMoM.trend : "neutral"}
            />
          )}
          <StatCard
            title={
              mode.id === 'manager' || mode.id === 'unit_manager'
                ? 'Pending Leave (Team)'
                : 'Pending Leave'
            }
            value={pendingRequestsCount !== null ? String(pendingRequestsCount) : '0'}
            change="Awaiting review"
            showVsLastMonth={false}
            icon={Calendar}
            trend="neutral"
          />
        </div>
        {/* Charts Section */}
        <div style={weeklyAttendanceContainerStyle} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Chart */}
          <Card style={weeklyAttendanceContainerStyle} className="dashboard-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-primary" />
                <span>Weekly Attendance</span>
              </CardTitle>
              <CardDescription>
                {mode.id === 'manager' || mode.id === 'unit_manager'
                  ? 'Your unit attendance this week'
                  : 'Employee attendance trends this week'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="present" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Org distribution — one hierarchy level at a time */}
          <Card className="dashboard-card">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    <span>
                      {distributionLevel === "sector"
                        ? "Sector Distribution"
                        : distributionLevel === "sub_sector"
                          ? "Sub-sector Distribution"
                          : "Unit Distribution"}
                    </span>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Headcount by Sector, Sub-sector, or Unit
                  </CardDescription>
                </div>
                {distributionOptions.length > 1 && (
                  <div className="flex flex-wrap gap-1">
                    {distributionOptions.map((opt) => (
                      <Button
                        key={opt.id}
                        type="button"
                        size="sm"
                        variant={distributionLevel === opt.id ? "default" : "outline"}
                        className="h-8"
                        onClick={() => setDistributionLevel(opt.id)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {departmentData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  No employees placed at this level yet
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={departmentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {departmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value} people`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                {(() => {
                  const total = departmentData.reduce((sum, d) => sum + (d.value || 0), 0);
                  return departmentData.map((dept) => {
                    const pct = total > 0 ? Math.round((dept.value / total) * 100) : 0;
                    return (
                      <div key={dept.name} className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: dept.color }}
                        />
                        <span className="text-sm text-muted-foreground">
                          {dept.name} · {dept.value} ({pct}%)
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
              {distributionSkipped > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  {distributionSkipped} employee{distributionSkipped === 1 ? "" : "s"} not
                  counted here (not assigned at this level).
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity and Events */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <Card style={recentActivities} className="dashboard-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-primary" />
                <span>Recent Activities</span>
              </CardTitle>
              <CardDescription>
                {mode.id === 'manager' || mode.id === 'unit_manager'
                  ? 'Last 7 days from your team'
                  : mode.id === 'sector_lead'
                    ? 'Last 7 days in your sector'
                    : 'Last 7 days across the organization'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loadingActivities && (
                  <p className="text-sm text-muted-foreground">Loading activity…</p>
                )}
                {!loadingActivities && activities.length === 0 && (
                  <p className="text-sm text-muted-foreground">No recent activity in your scope yet</p>
                )}
                {!loadingActivities && activityPaging.pagedItems.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent transition-colors">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={activity.actorAvatar || `https://ui-avatars.com/api/?name=${activity.actorName || activity.user}&background=3b82f6&color=fff`} />
                      <AvatarFallback>{(activity.actorName || activity.user || '').split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{activity.actorName || activity.user}</span> {activity.action}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(activity.createdAt || activity.time || Date.now()).toLocaleString()}</p>
                    </div>
                    <Badge variant={
                      activity.type === 'leave' ? 'secondary' :
                      activity.type === 'attendance' ? 'default' :
                      'outline'
                    }>
                      {activity.type}
                    </Badge>
                  </div>
                ))}
              </div>
              {activityPaging.showControls && (
                <ListPagination
                  className="mt-4"
                  page={activityPaging.page}
                  totalPages={activityPaging.totalPages}
                  hasPrev={activityPaging.hasPrev}
                  hasNext={activityPaging.hasNext}
                  rangeLabel={activityPaging.rangeLabel}
                  onPrev={() => activityPaging.setPage((p) => Math.max(1, p - 1))}
                  onNext={() =>
                    activityPaging.setPage((p) =>
                      Math.min(activityPaging.totalPages, p + 1)
                    )
                  }
                />
              )}
            </CardContent>
          </Card>

          {/* Today + upcoming events (dashboard only) */}
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span>Today & Upcoming</span>
              </CardTitle>
              <CardDescription>Events for today and the days ahead</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loadingEvents && (
                  <p className="text-sm text-muted-foreground">Loading events…</p>
                )}
                {!loadingEvents && upcomingEvents.length === 0 && (
                  <p className="text-sm text-muted-foreground">No events for today or upcoming</p>
                )}
                {!loadingEvents && upcomingEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => openEventInCalendar(event)}
                    className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div>
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-muted-foreground">{event.date}</p>
                    </div>
                    <Badge variant={
                      event.type === 'meeting' ? 'default' :
                      event.type === 'holiday' ? 'secondary' :
                      event.type === 'training' ? 'outline' :
                      event.type === 'personal' ? 'outline' :
                      'secondary'
                    }>
                      {event.type}
                    </Badge>
                  </button>
                ))}
              </div>
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => navigate('/calendar')}
              >
                View Calendar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Employee Mode
  return (
    <div className="container mx-auto p-6 space-y-8">
      <DashboardModeHero mode={mode} userName={user?.name} scopeLabel={scopeLabel} />
      <DashboardQuickActions mode={mode} authCaps={modeAuthCaps} />

      {/* Personal Stats — equal width/height cards */}
      <div
        style={wrapperStyle}
        className="grid grid-cols-1 gap-4 mb-5 items-stretch sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          title="Hours This Week"
          value={hoursThisWeek !== null ? String(hoursThisWeek) : '--'}
          change={hoursWoW.change}
          changeLabel="vs last week"
          showVsLastMonth={false}
          icon={Clock}
          trend={hoursWoW.trend}
        />
        <StatCard
          title="Attendance Rate"
          value={attendanceRateUser || '--'}
          change={attendanceRateWoW.change}
          changeLabel="vs last week"
          showVsLastMonth={false}
          icon={UserCheck}
          trend={attendanceRateWoW.trend}
        />
        <StatCard
          title="Latest Net Pay"
          value={currentSalary !== null ? formatEtb(currentSalary) : '--'}
          change={netPayDelta.change}
          changeLabel="vs previous pay"
          showVsLastMonth={false}
          icon={DollarSign}
          trend={netPayDelta.trend}
        />
        <StatCard
          title="Approved Leave Days"
          value={leaveBalanceDays !== null ? `${leaveBalanceDays} days` : '--'}
          change={
            leaveMoM.change ||
            (leavePendingMine != null && leavePendingMine > 0
              ? `${thisMonthLabel} · ${leavePendingMine} pending`
              : thisMonthLabel)
          }
          changeLabel={leaveMoM.change ? "vs last month" : null}
          showVsLastMonth={false}
          icon={Calendar}
          trend={leaveMoM.change ? leaveMoM.trend : "neutral"}
        />
      </div>

      {/* Personal Charts */}
      <div style={marginStyle} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Salary Progression */}
        <Card style={marginStyle} className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span>Salary Progression</span>
            </CardTitle>
            <CardDescription>Your approved / paid net pay (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salaryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatEtb(value)} />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Calendar preview (quick actions are above via mode panel) */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-primary" />
              <span>My Calendar</span>
            </CardTitle>
            <CardDescription>Today and upcoming dates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {!loadingEvents && upcomingEvents.slice(0, 3).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => openEventInCalendar(event)}
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-muted-foreground">{event.date}</p>
                  </div>
                  <Badge variant="secondary">{event.type}</Badge>
                </button>
              ))}
              {!loadingEvents && upcomingEvents.length === 0 && (
                <p className="text-sm text-muted-foreground">No events for today or upcoming</p>
              )}
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/calendar')}>
              View Full Calendar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Personal Activity */}
      <div className="grid grid-cols-1 gap-6">
        <Card style={marginStyle} className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-primary" />
              <span>My Recent Activity</span>
            </CardTitle>
            <CardDescription>Your activity from the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loadingActivities && (
                <p className="text-sm text-muted-foreground">Loading activity…</p>
              )}
              {!loadingActivities && activityPaging.pagedItems.map((activity) => (
                <div key={activity.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={activity.actorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activity.actorName || activity.user || 'U')}&background=3b82f6&color=fff`} />
                    <AvatarFallback>{(activity.actorName || activity.user || 'U').split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{activity.actorName || activity.user}</span> {activity.action}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(activity.createdAt || activity.time || Date.now()).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {!loadingActivities && activities.length === 0 && (
                <p className="text-sm text-muted-foreground">No recent activity yet</p>
              )}
            </div>
            {activityPaging.showControls && (
              <ListPagination
                className="mt-4"
                page={activityPaging.page}
                totalPages={activityPaging.totalPages}
                hasPrev={activityPaging.hasPrev}
                hasNext={activityPaging.hasNext}
                rangeLabel={activityPaging.rangeLabel}
                onPrev={() => activityPaging.setPage((p) => Math.max(1, p - 1))}
                onNext={() =>
                  activityPaging.setPage((p) =>
                    Math.min(activityPaging.totalPages, p + 1)
                  )
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;