import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../components/ui/table';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import {
  Clock, Calendar as CalendarIcon, UserCheck, UserX, Search, 
  Filter, Download, TrendingUp, CheckCircle, XCircle, AlertCircle,
  ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { exportTableExcel } from '../utils/exportExcel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Attendance = () => {
  const { t } = useLanguage();

  const wrapperStyle = {
    paddingBottom: "20px",
    marginTop: "20px"
  };

  const statCardsContainerStyle = {    
    alignItems: "stretch",
  };

  const marginStyle = {
    marginBottom: "10px"
  };

  const buttonStyle = {
    width: "200px"
  };

  const { user, canManage } = useAuth();
  // Managers and above see team roster; employees see personal view
  const teamView = canManage;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('today'); // 'today', 'week', 'month'
  const API_BASE = API_URL;
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;


  const [attendanceRecords, setAttendanceRecords] = useState([]); // HR date-based list
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [userAttendance, setUserAttendance] = useState([]); // Employee history (current page)
  const [historyWeekRecords, setHistoryWeekRecords] = useState([]); // Recent records for week/today cards
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPagination, setHistoryPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [loading, setLoading] = useState(false);
  const HISTORY_PAGE_SIZE = 10;
  const TEAM_PAGE_SIZE = 10;
  const [teamPage, setTeamPage] = useState(1);

  const isoDate = (d) => {
    // local YYYY-MM-DD (avoid timezone-induced off-by-one)
    try {
      const dd = new Date(d);
      const y = dd.getFullYear();
      const m = String(dd.getMonth() + 1).padStart(2, '0');
      const day = String(dd.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch (e) {
      return String(d).slice(0,10);
    }
  };
  
  // Normalize a record.date into YYYY-MM-DD without timezone ambiguity.
  const normalizeRecordDate = (recDate) => {
    if (!recDate && recDate !== 0) return null;
    // If it's already a YYYY-MM-DD string, return as-is
    if (typeof recDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(recDate)) return recDate;
    // Otherwise, fall back to isoDate which formats local date
    return isoDate(recDate);
  };

  // Loading flags for requests to avoid double clicks
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkOutLoading, setCheckOutLoading] = useState(false);

  const fetchByDate = async (dateObj) => {
    if (!token || !teamView) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/attendance`, {
        params: { date: isoDate(dateObj) },
        headers: { Authorization: `Bearer ${token}` },
      });
  setAttendanceRecords(Array.isArray(res.data?.data) ? res.data.data : []);
  setAttendanceStats(res.data?.stats || null);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyHistory = async (page = 1) => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/api/attendance/me`, {
        params: { limit: HISTORY_PAGE_SIZE, page },
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserAttendance(Array.isArray(res.data?.data) ? res.data.data : []);
      if (res.data?.pagination) {
        setHistoryPagination(res.data.pagination);
        setHistoryPage(res.data.pagination.page || page);
      } else {
        setHistoryPage(page);
      }
    } catch (err) {
      console.error(err);
      // non-blocking
    }
  };

  /** Recent records for today status + week summary (not paginated UI) */
  const fetchHistorySummary = async () => {
    if (!token || teamView) return;
    try {
      const res = await axios.get(`${API_BASE}/api/attendance/me`, {
        params: { limit: 14, page: 1 },
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistoryWeekRecords(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshStats = async (dateObj) => {
    // Only HR needs org-wide stats
    if (!token || !teamView) return;
    try {
      const res = await axios.get(`${API_BASE}/api/attendance/stats`, {
        params: { date: isoDate(dateObj || selectedDate) },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.stats) setAttendanceStats(res.data.stats);
    } catch (err) {
      // non-blocking
    }
  };

  useEffect(() => {
    if (teamView) fetchByDate(selectedDate);
    fetchMyHistory(1);
    fetchHistorySummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamView, token]);

  useEffect(() => {
    if (teamView) fetchByDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const filteredRecords = attendanceRecords
    .filter((record) => {
      const name = String(record.employeeName || '').toLowerCase();
      const dept = String(record.department || '').toLowerCase();
      const empId = String(record.employeeId || '').toLowerCase();
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        name.includes(q) || dept.includes(q) || empId.includes(q);
      const matchesFilter = filterStatus === 'all' || record.status === filterStatus;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) =>
      String(a.employeeName || '').localeCompare(String(b.employeeName || ''), undefined, {
        sensitivity: 'base',
      })
    );

  // Reset to first page when filters / date / dataset change
  useEffect(() => {
    setTeamPage(1);
  }, [searchTerm, filterStatus, selectedDate, attendanceRecords.length]);

  const teamTotalPages = Math.max(1, Math.ceil(filteredRecords.length / TEAM_PAGE_SIZE));
  const safeTeamPage = Math.min(teamPage, teamTotalPages);
  const teamPageStart = (safeTeamPage - 1) * TEAM_PAGE_SIZE;
  const pagedTeamRecords = filteredRecords.slice(
    teamPageStart,
    teamPageStart + TEAM_PAGE_SIZE
  );

  const handleExportDaily = () => {
    if (!filteredRecords.length) {
      toast.warn('No attendance records to export for this date');
      return;
    }
    const dateLabel = format(selectedDate, 'yyyy-MM-dd');
    const headers = [
      'No',
      'Employee',
      'Employee ID',
      'Unit / Sector',
      'Check In',
      'Check Out',
      'Working Hours',
      'Location',
      'Status',
    ];
    const rows = filteredRecords.map((r, i) => [
      i + 1,
      r.employeeName || '',
      r.employeeId || '',
      r.department || '',
      r.checkIn || '',
      r.checkOut || '',
      r.workingHours || r.hours || '',
      r.location || '',
      r.status || '',
    ]);
    exportTableExcel({
      title: 'Gamo Development Association — Daily Attendance',
      subtitle: `Date: ${format(selectedDate, 'PPP')} · ${filteredRecords.length} record(s)`,
      headers,
      rows,
      sheetName: 'Daily',
      filename: `GaDA-Attendance-Daily-${dateLabel}.xlsx`,
    });
    toast.success('Daily attendance Excel downloaded');
  };

  const handleExportMonthly = async () => {
    if (!token) return;
    const monthKey = format(selectedDate, 'yyyy-MM');
    const monthLabel = format(selectedDate, 'MMMM yyyy');
    try {
      toast.info('Building monthly attendance report…');
      const res = await axios.get(`${API_BASE}/api/attendance/monthly-report`, {
        params: { month: monthKey },
        headers: { Authorization: `Bearer ${token}` },
      });
      const rowsData = Array.isArray(res.data?.data) ? res.data.data : [];
      if (!rowsData.length) {
        toast.warn('No employees found for monthly report');
        return;
      }
      const workingDays = res.data?.meta?.workingDays ?? '';
      const headers = [
        'No',
        'Employee',
        'Employee ID',
        'Unit / Sector',
        'Working Days',
        'Present',
        'Late',
        'Leave',
        'Absent',
        'Days Attended',
        'Hours Worked',
        'Attendance Rate %',
      ];
      const rows = rowsData.map((r, i) => [
        i + 1,
        r.employeeName || '',
        r.employeeId || '',
        r.department || '',
        r.workingDays ?? workingDays,
        r.present ?? 0,
        r.late ?? 0,
        r.leave ?? 0,
        r.absent ?? 0,
        r.daysAttended ?? 0,
        r.totalHours || '0h 00m',
        r.attendanceRate ?? 0,
      ]);
      exportTableExcel({
        title: 'Gamo Development Association — Monthly Attendance Summary',
        subtitle: `Period: ${monthLabel} · Working days: ${workingDays} · ${rowsData.length} employee(s)`,
        headers,
        rows,
        sheetName: 'Monthly',
        filename: `GaDA-Attendance-Monthly-${monthKey}.xlsx`,
      });
      toast.success('Monthly attendance Excel downloaded');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Monthly export failed');
    }
  };
  const teamHasPrev = safeTeamPage > 1;
  const teamHasNext = safeTeamPage < teamTotalPages;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'present':
        return (
          <Badge variant="default" className="bg-success text-success-foreground">
            <CheckCircle className="w-3 h-3 mr-1" />
            Present
          </Badge>
        );
      case 'absent':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Absent
          </Badge>
        );
      case 'late':
        return (
          <Badge variant="secondary" className="bg-warning text-warning-foreground">
            <AlertCircle className="w-3 h-3 mr-1" />
            Late
          </Badge>
        );
      case 'leave':
        return (
          <Badge variant="outline">
            <Calendar className="w-3 h-3 mr-1" />
            On Leave
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const upsertLocalAttendance = (rec, today) => {
    const merge = (prev) => {
      try {
        const idx = prev.findIndex(r => normalizeRecordDate(r?.date) === today);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...rec };
          return copy;
        }
        return [rec, ...prev];
      } catch (e) {
        return prev;
      }
    };
    setUserAttendance(merge);
    setHistoryWeekRecords(merge);
  };

  const handleMarkAttendance = async () => {
    if (checkInLoading) return;
    setCheckInLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/attendance/check-in`, { location: 'Office' }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Attendance marked successfully!');
      const newRec = res.data?.data;
      const today = isoDate(new Date());
      if (newRec) {
        upsertLocalAttendance(newRec, today);
        setCheckedOutToday(!!(newRec.checkOut));
      } else {
        await Promise.all([fetchMyHistory(historyPage), fetchHistorySummary()]);
      }
      // server-side activity will create the activity; no client post to avoid duplicates
      if (teamView) {
        fetchByDate(selectedDate);
        await refreshStats(selectedDate);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to mark attendance');
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (checkOutLoading) return;
    setCheckOutLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/attendance/check-out`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Checked out successfully!');
      const updated = res.data?.data;
      const today = isoDate(new Date());
      if (updated) {
        upsertLocalAttendance(updated, today);
        setCheckedOutToday(true);
      } else {
        await Promise.all([fetchMyHistory(historyPage), fetchHistorySummary()]);
      }
      // server-side activity will create the activity; no client post to avoid duplicates
      if (teamView) {
        fetchByDate(selectedDate);
        await refreshStats(selectedDate);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to check out');
    } finally {
      setCheckOutLoading(false);
    }
  };

  // Prefer recent summary fetch for cards; fall back to current history page
  const summaryRecords = historyWeekRecords.length ? historyWeekRecords : userAttendance;

  // Personal today's status for non-HR user
  const myTodayStatus = useMemo(() => {
    const todayStrLocal = isoDate(selectedDate);
    const rec = summaryRecords.find(r => normalizeRecordDate(r?.date) === todayStrLocal);
    return rec?.status || 'absent';
  }, [summaryRecords, selectedDate]);

  const todayStats = useMemo(() => {
    if (teamView) {
      return (
        attendanceStats || {
          present: attendanceRecords.filter(r => r.status === 'present').length,
          absent: attendanceRecords.filter(r => r.status === 'absent').length,
          late: attendanceRecords.filter(r => r.status === 'late').length,
          leave: attendanceRecords.filter(r => r.status === 'leave').length,
          total: attendanceRecords.length
        }
      );
    }
    return {
      present: myTodayStatus === 'present' ? 1 : 0,
      late: myTodayStatus === 'late' ? 1 : 0,
      leave: myTodayStatus === 'leave' ? 1 : 0,
      absent: myTodayStatus === 'absent' ? 1 : 0,
      total: 1
    };
  }, [teamView, attendanceStats, attendanceRecords, myTodayStatus]);

  const attendanceRate = ((todayStats.present + todayStats.late) / todayStats.total * 100).toFixed(1);

  // --- Weekly summary for Employee view ---
  const getWeekBounds = (d) => {
    const date = new Date(d);
    const day = date.getDay(); // 0=Sun,1=Mon,...
    const diffToMonday = (day + 6) % 7; // days since Monday
    const start = new Date(date);
    start.setDate(date.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const parseWorkingMinutes = (s) => {
    if (!s || typeof s !== 'string') return 0;
    const m = s.match(/(\d+)h\s+(\d{1,2})m/);
    if (!m) return 0;
    const h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    return (isNaN(h) || isNaN(mm)) ? 0 : (h * 60 + mm);
  };

  const minutesToHoursStr = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  const minutesTo12h = (mins) => {
    if (mins === null || mins === undefined) return '--';
    let h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    let hour12 = h % 12;
    if (hour12 === 0) hour12 = 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const weekly = useMemo(() => {
    // Current week (Mon-Sun), capped at today
    const today = new Date();
    const { start, end } = getWeekBounds(today);
    const capEnd = new Date(Math.min(end.getTime(), today.getTime()));
    capEnd.setHours(23, 59, 59, 999);

    // Eligible working days: Mon-Fri up to capEnd
    let totalDays = 0;
    {
      const iter = new Date(start);
      while (iter <= capEnd) {
        const wd = iter.getDay();
        if (wd >= 1 && wd <= 5) totalDays += 1; // Mon-Fri
        iter.setDate(iter.getDate() + 1);
      }
    }

    // Filter my records within week bounds
    const weekRecords = summaryRecords.filter(r => {
      const d = new Date(r.date);
      return d >= start && d <= capEnd;
    });

    const daysPresent = weekRecords.filter(r => r.status === 'present' || r.status === 'late').length;
    const totalMinutes = weekRecords.reduce((acc, r) => acc + parseWorkingMinutes(r.workingHours || r.hours), 0);

    // Average check-in (over records that have checkIn)
    const checkIns = weekRecords
      .map(r => r.checkIn)
      .filter(Boolean)
      .map(t => {
        const [hh, mm] = String(t).split(':').map(Number);
        if (isNaN(hh) || isNaN(mm)) return null;
        return hh * 60 + mm;
      })
      .filter(v => v !== null);
    const avgCheckInMins = checkIns.length ? Math.round(checkIns.reduce((a, b) => a + b, 0) / checkIns.length) : null;

    const attendanceRate = totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0;

    return {
      daysPresent,
      totalDays,
      totalHours: minutesToHoursStr(totalMinutes),
      avgCheckIn: minutesTo12h(avgCheckInMins),
      attendanceRate,
    };
  }, [summaryRecords]);

  // Helpers for button states (today)
  const todayStr = isoDate(new Date());
  const todayRec = useMemo(() => summaryRecords.find(r => normalizeRecordDate(r?.date) === todayStr), [summaryRecords, todayStr]);

  // Track if checked out today for button color
  const [checkedOutToday, setCheckedOutToday] = useState(false);
  useEffect(() => {
    setCheckedOutToday(!!(todayRec && todayRec.checkOut));
  }, [todayRec]);

  const canCheckIn = !todayRec || !todayRec.checkIn;
  const canCheckOut = !!(todayRec && todayRec.checkIn && !todayRec.checkOut);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {teamView ? t('pages.attendance') : t('pages.attendanceMine')}
          </h1>
          <p className="text-muted-foreground">
            {teamView ? t('pages.attendanceDesc') : t('pages.attendanceMineDesc')}
          </p>
        </div>
        {teamView ? (
          <div className="flex gap-2">
            <Button onClick={handleMarkAttendance} className="btn-gradient" disabled={!canCheckIn} title={canCheckIn ? t('pages.markCheckIn') : t('pages.alreadyCheckedIn')}>
              <Clock className="w-4 h-4 mr-2" />
              {t('pages.checkIn')}
            </Button>
            <Button
              onClick={handleCheckOut}
              className={checkedOutToday ? 'btn-gradient' : 'btn-outline'}
              disabled={!canCheckOut}
              title={canCheckOut ? 'Mark my check-out' : 'Check-in first or already checked out'}
            >
              <Clock className="w-4 h-4 mr-2" />
              Check-out
            </Button>
          </div>
        ) : (
          <Button style={buttonStyle} onClick={handleMarkAttendance} className="btn-gradient" disabled={!canCheckIn} title={canCheckIn ? t('pages.markCheckIn') : t('pages.alreadyCheckedIn')}>
            <Clock className="w-4 h-4 mr-2" />
            {t('pages.markCheckIn')}
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div style={wrapperStyle} className="flex flex-wrap gap-4 mb-5">
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('pages.present')}</p>
                  <p className="text-xl font-bold">{todayStats.present}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-destructive/10 rounded-lg flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('pages.absent')}</p>
                  <p className="text-xl font-bold">{todayStats.absent}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('pages.late')}</p>
                  <p className="text-xl font-bold">{todayStats.late}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('pages.onLeave')}</p>
                  <p className="text-xl font-bold">{todayStats.leave}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('pages.rate')}</p>
                  <p className="text-xl font-bold">{attendanceRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {teamView ? (
        <>
          {/* Filters */}
          <Card style={marginStyle} className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4 mb-5">
                {/* Search Input */}
                <div className="flex-1 min-w-[250px] sm:min-w-[250px] md:min-w-[200px] lg:min-w-[200px]">
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search employees..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full"
                    />
                  </div>
                </div>

                {/* Filter Status */}
                <div className="flex-1 min-w-[250px] sm:min-w-[250px] md:min-w-[200px] lg:min-w-[200px]">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                      <SelectItem value="late">Late</SelectItem>
                      <SelectItem value="leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Picker */}
                <div className="flex-1 min-w-[250px] sm:min-w-[250px] md:min-w-[200px] lg:min-w-[200px]">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {format(selectedDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Export: daily or monthly */}
                <div className="flex-1 min-w-[250px] sm:min-w-[250px] md:min-w-[200px] lg:min-w-[220px]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" className="w-full">
                        <Download className="w-4 h-4 mr-2" />
                        Export Excel
                        <ChevronDown className="w-4 h-4 ml-2 opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={handleExportDaily}>
                        Daily — {format(selectedDate, 'MMM d, yyyy')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportMonthly}>
                        Monthly — {format(selectedDate, 'MMMM yyyy')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Table */}
          <Card className="data-table">
            <CardHeader>
              <CardTitle>{t('pages.todaysAttendance')}</CardTitle>
              <CardDescription>
                Employee attendance for {format(selectedDate, "PPP")}
                {filteredRecords.length > 0
                  ? ` · showing ${Math.min(teamPageStart + 1, filteredRecords.length)}–${Math.min(
                      teamPageStart + TEAM_PAGE_SIZE,
                      filteredRecords.length
                    )} of ${filteredRecords.length} (A–Z by name)`
                  : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Unit / Sector</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Working Hours</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <p className="text-sm text-muted-foreground">Loading attendance…</p>
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && filteredRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No attendance records found
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && pagedTeamRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage
                              src={
                                record.profileImage ||
                                record.avatar ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(record.employeeName || '')}&background=0D8ABC&color=fff`
                              }
                              alt={record.employeeName}
                            />
                            <AvatarFallback>
                              {String(record.employeeName || '')
                                .split(' ')
                                .map((n) => n[0])
                                .join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{record.employeeName}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{record.department}</TableCell>
                      <TableCell>
                        {record.checkIn ? (
                          <span className="text-success">{record.checkIn}</span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.checkOut ? (
                          <span className="text-success">{record.checkOut}</span>
                        ) : record.checkIn ? (
                          <span className="text-warning">Working...</span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "font-medium",
                          record.status === 'present' ? "text-success" :
                          record.status === 'late' ? "text-warning" :
                          "text-muted-foreground"
                        )}>
                          {record.workingHours}
                        </span>
                      </TableCell>
                      <TableCell>
                        {record.location ? (
                          <Badge variant="outline">{record.location}</Badge>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {!loading && filteredRecords.length > TEAM_PAGE_SIZE && (
                <div className="flex items-center justify-between gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!teamHasPrev}
                    onClick={() => setTeamPage((p) => Math.max(1, Math.min(teamTotalPages, p) - 1))}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Page {safeTeamPage} of {teamTotalPages}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!teamHasNext}
                    onClick={() => setTeamPage((p) => Math.min(teamTotalPages, Math.min(teamTotalPages, p) + 1))}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        // Employee View
        <>
          {/* Personal Attendance Card */}
          <div style={marginStyle}  className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card style={marginStyle} className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span>Today's Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{t('pages.checkIn')}</p>
                    <p className="text-2xl font-bold text-success">{
                      (todayRec?.checkIn) || '--'
                    }</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{t('pages.workingHours')}</p>
                    <p className="text-2xl font-bold text-primary">{
                      (todayRec?.workingHours) || '0h 00m'
                    }</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-success/10 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <span className="font-medium">{
                      (todayRec?.status || 'Present')
                    }</span>
                  </div>
                  <Badge variant="outline">Office</Badge>
                </div>
                <Button
                  style={buttonStyle}
                  className={checkedOutToday ? 'btn-gradient w-full' : 'btn-outline w-full'}
                  onClick={handleCheckOut}
                  disabled={!canCheckOut}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Check Out
                </Button>
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <span>This Week Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{t('pages.daysPresent')}</p>
                    <p className="text-2xl font-bold">{weekly.daysPresent}/{weekly.totalDays}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{t('pages.totalHours')}</p>
                    <p className="text-2xl font-bold">{weekly.totalHours}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Avg. Check-in</p>
                    <p className="text-lg font-semibold">{weekly.avgCheckIn}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{t('dashboard.attendanceRate')}</p>
                    <p className="text-lg font-semibold text-success">{weekly.attendanceRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Personal Attendance History */}
          <Card className="data-table">
            <CardHeader>
              <CardTitle>{t('pages.myHistory')}</CardTitle>
              <CardDescription>
                Your recent attendance records
                {historyPagination.total > 0
                  ? ` · showing ${Math.min(
                      (historyPagination.page - 1) * historyPagination.limit + 1,
                      historyPagination.total
                    )}–${Math.min(
                      historyPagination.page * historyPagination.limit,
                      historyPagination.total
                    )} of ${historyPagination.total}`
                  : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Working Hours</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userAttendance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No attendance records yet
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    userAttendance.map((record, index) => (
                      <TableRow key={record.id || `${record.date}-${index}`}>
                        <TableCell className="font-medium">
                          {format(new Date(record.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          {record.checkIn ? (
                            <span className="text-success">{record.checkIn}</span>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.checkOut ? (
                            <span className="text-success">{record.checkOut}</span>
                          ) : record.checkIn ? (
                            <span className="text-warning">Working...</span>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "font-medium",
                            record.status === 'present' ? "text-success" :
                            record.status === 'late' ? "text-warning" :
                            "text-muted-foreground"
                          )}>
                            {record.workingHours || record.hours}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {historyPagination.totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!historyPagination.hasPrev}
                    onClick={() => fetchMyHistory(historyPage - 1)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Page {historyPagination.page} of {historyPagination.totalPages}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!historyPagination.hasNext}
                    onClick={() => fetchMyHistory(historyPage + 1)}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

    </div>
  );
};

export default Attendance;