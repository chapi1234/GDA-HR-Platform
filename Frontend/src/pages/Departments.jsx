import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import axios from 'axios';
import {
  Building2, Plus, Edit, Trash2, Users, DollarSign, 
  TrendingUp, Search, MoreHorizontal
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useClientPagination } from '../hooks/useClientPagination';
import ListPagination from '../components/ListPagination';
const API_URL = import.meta.env.VITE_API_URL;

const Departments = () => {
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
  };

  const { isHR } = useAuth();
  // Legacy page — prefer /sectors going forward
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);

  const [departments, setDepartments] = useState([]);

  const [newDepartment, setNewDepartment] = useState({
    name: '',
    description: '',
    head: '',
    location: '',
    budget: ''
  });

  const API_BASE = API_URL;
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  // Normalize/enrich a department object coming from the API so the UI can always
  // display a head name/avatar regardless of whether the API returned an id or
  // a populated head object.
  const enrichDepartment = (dept) => {
    // find employee by id in local employees cache
    const rawHead = dept.head;
    // headId determination: if API returned headId property use it, else if head looks like an id use that
    const headId = dept.headId || (rawHead && typeof rawHead === 'string' && /^[0-9a-fA-F]{24}$/.test(rawHead) ? rawHead : null) || null;
    // try to find employee name from local cache
    const emp = headId ? employees.find(e => e.id === headId) : null;
    const headName = emp ? emp.name : (rawHead && typeof rawHead === 'object' ? rawHead.name : (typeof rawHead === 'string' ? rawHead : ''));
    const headAvatar = emp?.profileImage || dept.headAvatar || (headName ? `https://ui-avatars.com/api/?name=${encodeURIComponent(headName)}&background=3b82f6&color=fff` : '');
    return {
      id: dept.id || dept._id || (dept._id && String(dept._id)),
      name: dept.name,
      description: dept.description,
      head: headName,
      headId: headId || (dept.headId || null),
      headAvatar,
      employeeCount: dept.employeeCount || 0,
      averageSalary: dept.averageSalary || 0,
      budget: dept.budget || 0,
      location: dept.location,
      established: dept.established || '',
    };
  };

  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/departments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const apiDepts = res.data?.data || [];
      setDepartments(apiDepts.map(enrichDepartment));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to load units');
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // normalize to { id, name, profileImage } so Select values work consistently
      const items = (res.data?.data || []).map(e => ({ id: e._id || e.id, name: e.name, profileImage: e.profileImage }));
      setEmployees(items);
      // re-enrich any already-fetched departments so head names resolve once employees are loaded
      setDepartments(prev => prev.map(enrichDepartment));
    } catch (err) {
      console.error('failed to load employees', err);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchDepartments();
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dept.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dept.head || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deptPaging = useClientPagination(filteredDepartments, 10, [
    searchTerm,
    departments.length,
  ]);

  const handleAddDepartment = async () => {
    if (!newDepartment.name || !newDepartment.description) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      const payload = {
        ...newDepartment,
        // send head as employee id (empty string -> null)
        head: newDepartment.head || null,
        budget: newDepartment.budget ? Number(newDepartment.budget) : 0,
      };
      const res = await axios.post(`${API_BASE}/api/departments`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
  const created = res.data?.data;
      if (!created) throw new Error('No department returned');
  setDepartments(prev => [...prev, enrichDepartment(created)]);
      setNewDepartment({ name: '', description: '', head: '', location: '', budget: '' });
      setShowAddDialog(false);
      toast.success('Unit added successfully!');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to add unit');
    }
  };

  const handleUpdateDepartment = async () => {
    if (!editingDepartment.name || !editingDepartment.description) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      const payload = {
        ...editingDepartment,
        head: editingDepartment.head || null,
        budget: editingDepartment.budget ? Number(editingDepartment.budget) : 0,
      };
      const res = await axios.put(`${API_BASE}/api/departments/${editingDepartment.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
  const updated = res.data?.data;
      if (!updated) throw new Error('No department returned');
  setDepartments(prev => prev.map(d => d.id === updated.id ? enrichDepartment(updated) : d));
      setEditingDepartment(null);
      toast.success('Unit updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to update unit');
    }
  };

  const handleDeleteDepartment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this unit?')) return;
    try {
      await axios.delete(`${API_BASE}/api/departments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDepartments(prev => prev.filter(dept => dept.id !== id));
      toast.success('Unit deleted successfully!');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to delete unit');
    }
  };

  const totalEmployees = departments.reduce((sum, dept) => sum + dept.employeeCount, 0);
  const totalBudget = departments.reduce((sum, dept) => sum + dept.budget, 0);

  if (!isHR) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">Only HR managers can access this legacy page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-950 px-4 py-3 text-sm">
        <strong>Legacy page.</strong> Org structure is now managed under{" "}
        <Link to="/sectors" className="underline font-medium text-amber-900">
          Sectors
        </Link>
        . Prefer that for Business / Charity units and assignments.
      </div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Legacy Units</h1>
          <p className="text-muted-foreground">
            Prefer Sectors for Business / Charity structure. This page is kept for old data only.
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild style={{ ...marginStyle, ...button }}>
            <Button className="btn-gradient">
              <Plus className="w-4 h-4 mr-2" />
              Add Legacy Unit
            </Button>
          </DialogTrigger>

          {/* <..................Add department dialog content ..................................> */}

          <DialogContent style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <DialogHeader>
              <DialogTitle>Add Legacy Unit</DialogTitle>
              <DialogDescription>
                Prefer creating units under Sectors. This form is for legacy entries only.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Unit Name *</Label>
                <Input
                  id="name"
                  value={newDepartment.name}
                  onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                  placeholder="e.g., Tourism Development"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={newDepartment.description}
                  onChange={(e) => setNewDepartment({ ...newDepartment, description: e.target.value })}
                  placeholder="Brief description of the unit"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="head">Unit Lead</Label>
                <Select value={newDepartment.head} onValueChange={(value) => setNewDepartment({ ...newDepartment, head: value })}>
                  <SelectTrigger>
                    <SelectValue>
                      {employees.find(e => e.id === newDepartment.head)?.name || 'Select unit lead'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={newDepartment.location}
                  onChange={(e) => setNewDepartment({ ...newDepartment, location: e.target.value })}
                  placeholder="Office location"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">Annual Budget</Label>
                <Input
                  id="budget"
                  type="number"
                  value={newDepartment.budget}
                  onChange={(e) => setNewDepartment({ ...newDepartment, budget: e.target.value })}
                  placeholder="Budget in USD"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddDepartment} className="btn-gradient">
                Add Legacy Unit
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overview Stats */}
      <div style={wrapperStyle} className="flex flex-wrap gap-4 mb-5">
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Legacy Units</p>
                  <p className="text-xl font-bold">{departments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Employees</p>
                  <p className="text-xl font-bold">{totalEmployees}</p>
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
                  <DollarSign className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Budget</p>
                  <p className="text-xl font-bold">${(totalBudget / 1000000).toFixed(1)}M</p>
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
                  <p className="text-sm text-muted-foreground">Avg Team Size</p>
                  <p className="text-xl font-bold">{Math.round(totalEmployees / departments.length)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search */}
      <Card style={marginStyle} className="dashboard-card">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search units..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Departments Grid */}
      <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {deptPaging.pagedItems.map((department) => (
          <Card style={marginStyle} key={department.id} className="dashboard-card hover:shadow-card-hover transition-all duration-200">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{department.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{department.location}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription className="text-sm">
                {department.description}
              </CardDescription>

              {/* Department Head */}
              <div className="flex items-center space-x-3 p-3 bg-accent rounded-lg">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={department.headAvatar} alt={department.head} />
                  <AvatarFallback>{department.head?.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{department.head}</p>
                  <p className="text-xs text-muted-foreground">Unit Lead</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Employees</p>
                  <p className="font-semibold flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {department.employeeCount}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Avg Salary</p>
                  <p className="font-semibold flex items-center">
                    <DollarSign className="w-4 h-4 mr-1" />
                    ${(department.averageSalary / 1000).toFixed(0)}k
                  </p>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-muted-foreground">Annual Budget</p>
                  <p className="font-semibold text-lg text-primary">
                    ${(department.budget / 1000000).toFixed(1)}M
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => setEditingDepartment({ ...department, head: department.headId || department.head })}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteDepartment(department.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {deptPaging.showControls && (
        <ListPagination
          page={deptPaging.page}
          totalPages={deptPaging.totalPages}
          hasPrev={deptPaging.hasPrev}
          hasNext={deptPaging.hasNext}
          rangeLabel={deptPaging.rangeLabel}
          onPrev={() => deptPaging.setPage((p) => Math.max(1, p - 1))}
          onNext={() =>
            deptPaging.setPage((p) => Math.min(deptPaging.totalPages, p + 1))
          }
        />
      )}
      </div>

      {filteredDepartments.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No units found</h3>
          <p className="text-muted-foreground">Try adjusting your search or add a new unit under Sectors</p>
        </div>
      )}

      {/* Edit Department Dialog */}
      <Dialog open={!!editingDepartment} onOpenChange={(open) => !open && setEditingDepartment(null)}>
        <DialogContent style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle>Edit Legacy Unit</DialogTitle>
            <DialogDescription>Update this legacy unit entry. Prefer Sectors for new structure.</DialogDescription>
          </DialogHeader>
          {editingDepartment && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Unit Name *</Label>
                <Input
                  id="edit-name"
                  value={editingDepartment.name}
                  onChange={(e) => setEditingDepartment({ ...editingDepartment, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description *</Label>
                <Textarea
                  id="edit-description"
                  value={editingDepartment.description}
                  onChange={(e) => setEditingDepartment({ ...editingDepartment, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-head">Unit Lead</Label>
                <Select value={editingDepartment.head} onValueChange={(value) => setEditingDepartment({ ...editingDepartment, head: value })}>
                  <SelectTrigger>
                    <SelectValue>
                      {employees.find(e => e.id === editingDepartment.head)?.name || 'Select unit lead'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={editingDepartment.location}
                  onChange={(e) => setEditingDepartment({ ...editingDepartment, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-budget">Annual Budget</Label>
                <Input
                  id="edit-budget"
                  type="number"
                  value={editingDepartment.budget}
                  onChange={(e) => setEditingDepartment({ ...editingDepartment, budget: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setEditingDepartment(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateDepartment} className="btn-gradient">
              Update Unit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Departments;