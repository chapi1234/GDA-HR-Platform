import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../components/ui/table';
import {
  Search, Plus, Filter, Check, X, Calendar, Clock,
  User, FileText, AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { postActivity } from '../lib/postActivity';
import { useClientPagination } from '../hooks/useClientPagination';
import ListPagination from '../components/ListPagination';
const API_URL = import.meta.env.VITE_API_URL;

const LeaveRequests = () => {

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

  const button = {
    width: "200px"
  }
  
  const { canManage, user } = useAuth();
  const canReview = canManage; // managers + HR + admin + superadmin
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);

  const API_BASE = API_URL;
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const [leaveRequests, setLeaveRequests] = useState([]);

  const [newLeave, setNewLeave] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: ''
  });

  const statusOptions = ['all', 'pending', 'approved', 'rejected'];
  const leaveTypes = ['Annual Leave', 'Sick Leave', 'Personal Leave', 'Maternity Leave', 'Paternity Leave', 'Bereavement Leave'];

  // Map frontend labels to backend enum and vice versa
  const toBackendType = (label) => {
    const map = {
      'Annual Leave': 'vacation',
      'Sick Leave': 'sick',
      'Personal Leave': 'personal',
      'Maternity Leave': 'maternity',
      'Paternity Leave': 'paternity',
      'Bereavement Leave': 'bereavement',
      'Emergency Leave': 'personal',
    };
    return map[label] || 'personal';
  };
  const toFrontendType = (type) => {
    const map = {
      vacation: 'Annual Leave',
      sick: 'Sick Leave',
      personal: 'Personal Leave',
      maternity: 'Maternity Leave',
      paternity: 'Paternity Leave',
      bereavement: 'Bereavement Leave',
    };
    return map[type] || type;
  };

  const mapLeave = (l) => ({
    id: l._id,
    employeeId: l.employee?.employeeId || '',
    employeeName: l.employee?.name || '',
    // include avatar/profileImage so UI can render persisted images when available
    profileImage: l.employee?.profileImage || '',
    avatar: l.employee?.avatar || '',
    leaveType: toFrontendType(l.type),
    startDate: l.startDate,
    endDate: l.endDate,
    duration: l.days,
    reason: l.reason,
    status: l.status,
    appliedDate: l.createdAt,
    reviewedBy: l.manager?.name || null,
    reviewDate: l.approvalDate || null,
  });

  const fetchLeaves = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/leave`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const items = Array.isArray(res.data?.data) ? res.data.data : [];
      setLeaveRequests(items.map(mapLeave));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to load leave requests');
    }
  };

  useEffect(() => {
    if (token) fetchLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canReview]);

  // Backend already scopes: HR = all, Employee = own only.
  // Do not filter by employeeId client-side to avoid hiding valid items when employeeId is missing/mismatched.
  const filteredRequests = leaveRequests.filter(request => {
    const matchesSearch = request.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const leavePaging = useClientPagination(filteredRequests, 10, [
    searchTerm,
    filterStatus,
    leaveRequests.length,
  ]);

  const calculateDuration = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleAddLeave = async () => {
    if (!newLeave.leaveType || !newLeave.startDate || !newLeave.endDate || !newLeave.reason) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      const payload = {
        type: toBackendType(newLeave.leaveType),
        startDate: newLeave.startDate,
        endDate: newLeave.endDate,
        reason: newLeave.reason,
      };
      const res = await axios.post(`${API_BASE}/api/leave`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
  setNewLeave({ leaveType: '', startDate: '', endDate: '', reason: '' });
  setShowAddDialog(false);
  await fetchLeaves();
  toast.success('Leave request submitted successfully!');
      // Post activity (non-blocking)
      try {
        postActivity({ token, actor: user?.id || user?._id, action: 'Submitted leave request', type: 'leave', meta: { startDate: payload.startDate, endDate: payload.endDate, leaveType: payload.type } });
      } catch (e) { /* ignore */ }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to submit leave request');
    }
  };

  const handleApproveReject = async (id, status) => {
    try {
      await axios.patch(`${API_BASE}/api/leave/${id}/review`, { status }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Refresh item
      await fetchLeaves();
      toast.success(`Leave request ${status} successfully!`);
      try {
        postActivity({ token, actor: user?.id || user?._id, action: `Leave request ${status}`, type: 'leave', meta: { id, status } });
      } catch (e) { /* ignore */ }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to update request');
    }
  };

  const handleCancel = async (id) => {
    try {
      await axios.delete(`${API_BASE}/api/leave/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLeaveRequests(prev => prev.filter(r => r.id !== id));
      toast.success('Leave request cancelled');
      try {
        postActivity({ token, actor: user?.id || user?._id, action: 'Cancelled leave request', type: 'leave', meta: { id } });
      } catch (e) { /* ignore */ }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to cancel request');
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: { variant: 'secondary', label: 'Pending', icon: Clock },
      approved: { variant: 'default', label: 'Approved', icon: Check },
      rejected: { variant: 'destructive', label: 'Rejected', icon: X }
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const pendingRequests = leaveRequests.filter(r => r.status === 'pending').length;
  const approvedRequests = leaveRequests.filter(r => r.status === 'approved').length;
  const totalRequests = leaveRequests.length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leave Requests</h1>
          <p className="text-muted-foreground">
            {canReview ? 'Manage employee leave requests' : 'Submit and track your leave requests'}
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild style={{ ...marginStyle, ...button }}>
            <Button className="btn-gradient">
              <Plus className="w-4 h-4 mr-2" />
              Request Leave
            </Button>
          </DialogTrigger>
          <DialogContent style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <DialogHeader>
              <DialogTitle>Submit Leave Request</DialogTitle>
              <DialogDescription>Fill in the details for your leave request</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="leaveType">Leave Type</Label>
                <Select value={newLeave.leaveType} onValueChange={(value) => setNewLeave({ ...newLeave, leaveType: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={newLeave.startDate}
                  onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={newLeave.endDate}
                  onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Please provide a reason for your leave..."
                  value={newLeave.reason}
                  onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                />
              </div>
              {newLeave.startDate && newLeave.endDate && (
                <div className="p-3 bg-accent rounded-lg">
                  <p className="text-sm font-medium">
                    Duration: {calculateDuration(newLeave.startDate, newLeave.endDate)} day(s)
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddLeave} className="btn-gradient">
                Submit Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div style={wrapperStyle} className="flex flex-wrap gap-4 mb-5">
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRequests}</div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>
        </div>
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingRequests}</div>
              <p className="text-xs text-muted-foreground">
                {canReview ? 'Require your attention' : 'Awaiting approval'}
              </p>
            </CardContent>
          </Card>
        </div>
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved Requests</CardTitle>
              <Check className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approvedRequests}</div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <Card style={marginStyle} className="dashboard-card">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4 mb-5">
            <div className="relative flex-1 min-w-full sm:min-w-[250px] md:min-w-[300px] lg:min-w-[240px]">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex-1 min-w-full sm:min-w-[250px] md:min-w-[220px] lg:min-w-[180px]">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(status => (
                    <SelectItem key={status} value={status}>
                      {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leave Requests Table */}
      <Card className="data-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Leave Type</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Applied Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leavePaging.pagedItems.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage
                        src={
                          request.profileImage ||
                          request.avatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(request.employeeName)}&background=0D8ABC&color=fff`
                        }
                        alt={request.employeeName}
                      />
                      <AvatarFallback>{request.employeeName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{request.employeeName}</p>
                      <p className="text-sm text-muted-foreground">{request.employeeId}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{request.leaveType}</TableCell>
                <TableCell>{new Date(request.startDate).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(request.endDate).toLocaleDateString()}</TableCell>
                <TableCell>{request.duration} day(s)</TableCell>
                <TableCell>{getStatusBadge(request.status)}</TableCell>
                <TableCell>{new Date(request.appliedDate).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    {canReview && request.status === 'pending' && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => handleApproveReject(request.id, 'approved')}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleApproveReject(request.id, 'rejected')}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {!canReview && request.status === 'pending' && request.employeeId === (user?.employeeId || '') && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleCancel(request.id)}
                      >
                        <X className="w-4 h-4" /> Cancel
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {leavePaging.showControls && (
          <div className="p-4 pt-0">
            <ListPagination
              page={leavePaging.page}
              totalPages={leavePaging.totalPages}
              hasPrev={leavePaging.hasPrev}
              hasNext={leavePaging.hasNext}
              rangeLabel={leavePaging.rangeLabel}
              onPrev={() => leavePaging.setPage((p) => Math.max(1, p - 1))}
              onNext={() =>
                leavePaging.setPage((p) =>
                  Math.min(leavePaging.totalPages, p + 1)
                )
              }
            />
          </div>
        )}
      </Card>

      {filteredRequests.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No leave requests found</h3>
          <p className="text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
};

export default LeaveRequests;