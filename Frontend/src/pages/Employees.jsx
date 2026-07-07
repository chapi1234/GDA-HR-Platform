import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
// xlsx not needed - using built-in CSV export
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../components/ui/table';
import {
  Search, Plus, Filter, Edit, Trash2, Mail, Phone, MapPin,
  Building2, Calendar, DollarSign, MoreHorizontal, UserPlus, Users, Download
} from 'lucide-react';
import { toast } from 'react-toastify';
const API_URL = import.meta.env.VITE_API_URL;

const Employees = () => {
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
  
  const { isHR } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'grid' or 'table'
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  // Departments from backend: [{ id, name }]
  const [departments, setDepartments] = useState([]);
  const departmentNames = useMemo(() => departments.map(d => d.name), [departments]);
  const API_BASE = API_URL;
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = res.data?.data || [];
      setEmployees(list);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  // Fetch departments as { id, name }
  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/departments/public-list`);
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setDepartments(list);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to load departments');
    }
  };

  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    departmentId: '',
    position: '',
    salary: '',
    address: '',
    role: 'employee',
    educationLevel: '',
    gradeLevel: '',
    joinDate: new Date().toISOString().split('T')[0]
  });

  const [editingEmployee, setEditingEmployee] = useState(null);

  const filteredEmployees = employees.filter(employee => {
    const q = (searchTerm || '').toLowerCase();
    const name = (employee?.name || '').toString().toLowerCase();
    const email = (employee?.email || '').toString().toLowerCase();
    const dept = (employee?.department || '').toString().toLowerCase();

    const matchesSearch = q === '' || name.includes(q) || email.includes(q) || dept.includes(q);
    const matchesDepartment = filterDepartment === 'all' || (employee?.department === filterDepartment);
    return matchesSearch && matchesDepartment;
  });

  const handleAddEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email || !newEmployee.departmentId) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      const payload = {
        name: newEmployee.name,
        email: newEmployee.email,
        password: newEmployee.password,
        phone: newEmployee.phone,
        departmentId: newEmployee.departmentId,
        position: newEmployee.position,
        salary: newEmployee.salary ? Number(newEmployee.salary) : undefined,
        address: newEmployee.address,
        role: newEmployee.role,
        educationLevel: newEmployee.educationLevel,
        gradeLevel: newEmployee.gradeLevel,
        joinDate: newEmployee.joinDate,
        status: 'active',
      };
      const res = await axios.post(`${API_BASE}/api/employees/create`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const created = res.data?.data;
      if (!created) throw new Error('No employee returned');
      setEmployees(prev => [...prev, created]);
      setNewEmployee({
        name: '', email: '', password: '', phone: '', departmentId: '', position: '',
        salary: '', address: '', role: 'employee', educationLevel: '', gradeLevel: '',
        joinDate: new Date().toISOString().split('T')[0]
      });
      setShowAddDialog(false);
      if (res.data?.emailSent) {
        toast.success(res.data?.emailNotice || 'Employee added and welcome email queued.');
      } else {
        toast.warning(
          res.data?.emailNotice ||
            'Employee added, but the welcome email could not be sent.'
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to add employee');
    }
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee({
      ...employee,
      departmentId: employee.departmentId || '',
      role: employee.role || 'employee',
      educationLevel: employee.education?.[0]?.degree || '',
      gradeLevel: employee.gradeLevel || '',
      salary: employee?.salary != null ? String(employee.salary) : ''
    });
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee.name || !editingEmployee.email || !editingEmployee.departmentId) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      const payload = {
        name: editingEmployee.name,
        email: editingEmployee.email,
        phone: editingEmployee.phone,
        departmentId: editingEmployee.departmentId,
        position: editingEmployee.position,
        role: editingEmployee.role,
        educationLevel: editingEmployee.educationLevel,
        gradeLevel: editingEmployee.gradeLevel,
        salary: editingEmployee.salary ? Number(editingEmployee.salary) : undefined,
      };
      const res = await axios.put(`${API_BASE}/api/employees/edit/${editingEmployee.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updated = res.data?.data;
      if (!updated) throw new Error('No employee returned');
      setEmployees(prev => prev.map(emp => emp.id === updated.id ? updated : emp));
      setEditingEmployee(null);
      toast.success('Employee updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to update employee');
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
    try {
      await axios.delete(`${API_BASE}/api/employees/delete/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEmployees(prev => prev.filter(emp => emp.id !== id));
      toast.success('Employee removed successfully!');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to remove employee');
    }
  };

  const handleExportExcel = () => {
    if (employees.length === 0) {
      toast.warn('No employees to export');
      return;
    }

    // Column headers matching the docx template
    const headers = [
      'No',
      'Name',
      'Gender',
      'Date of Birth',
      'Education Level',
      'Job Title',
      'Department',
      'Date of Joining',
      'Salary',
      'Grade / Level',
      'Service Year',
      'Retirement Year',
      'National ID',
      'Phone Number',
      'Emergency Contact',
      'Emergency Contact Phone'
    ];

    // Helper: wrap a cell value in quotes and escape internal quotes
    const escapeCell = (val) => {
      const str = val === null || val === undefined ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = employees.map((emp, index) => {
      const joinYear = emp.joinDate ? new Date(emp.joinDate).getFullYear() : '';
      const serviceYear = joinYear ? (new Date().getFullYear() - joinYear) : '';
      const birthYear = emp.dateOfBirth ? new Date(emp.dateOfBirth).getFullYear() : '';
      const retirementYear = birthYear ? birthYear + 60 : '';

      const educationStr =
        Array.isArray(emp.education) && emp.education.length > 0
          ? `${emp.education[0].degree || ''} ${emp.education[0].fieldOfStudy || ''}`.trim()
          : '';

      return [
        index + 1,
        emp.name || '',
        emp.gender === 'M' ? 'Male' : emp.gender === 'F' ? 'Female' : emp.gender || '',
        emp.dateOfBirth || '',
        educationStr,
        emp.position || '',
        emp.department || '',
        emp.joinDate || '',
        emp.salary || '',
        emp.gradeLevel || '',
        serviceYear,
        retirementYear,
        emp.nationalId || '',
        emp.phone || '',
        emp.emergencyContact || '',
        emp.emergencyPhone || '',
      ].map(escapeCell).join(',');
    });

    const csvContent = [
      headers.map(escapeCell).join(','),
      ...rows,
    ].join('\r\n');

    // BOM ensures Excel opens the file in UTF-8 correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Gamo_Development_Association_Employee_profile.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Count how many employees have missing key fields
    const incomplete = employees.filter(emp =>
      !emp.gradeLevel || !emp.nationalId || !emp.emergencyContact || !emp.emergencyPhone ||
      !emp.dateOfBirth || !(emp.education?.length > 0)
    ).length;

    toast.success(`Exported ${employees.length} employee(s) successfully!`);
    if (incomplete > 0) {
      toast.warn(`${incomplete} employee(s) have incomplete profile data (education, grade, national ID, or emergency contact). Ask them to update their profiles.`);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'on_leave':
        return <Badge variant="secondary">On Leave</Badge>;
      case 'inactive':
        return <Badge variant="outline">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchEmployees();
    fetchDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isHR) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">Only HR managers can access employee management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Employee Management</h1>
          <p className="text-muted-foreground">Manage your organization's workforce</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={handleExportExcel} style={{ ...marginStyle, ...button }} className="border-primary text-primary hover:bg-primary/10">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild style={{ ...marginStyle, ...button }}>
              <Button className="btn-gradient">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Employee
              </Button>
            </DialogTrigger>
          <DialogContent style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
              <DialogDescription>Enter employee details to add them to the system.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  value={newEmployee.password}
                  onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                  placeholder="Enter password"
                />
              </div>              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={newEmployee.phone}
                  onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Select 
                    value={newEmployee.departmentId} 
                    onValueChange={(value) => setNewEmployee({ ...newEmployee, departmentId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary">Salary</Label>
                  <Input
                    id="salary"
                    type="number"
                    value={newEmployee.salary}
                    onChange={(e) => setNewEmployee({ ...newEmployee, salary: e.target.value })}
                    placeholder="Annual salary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    value={newEmployee.position}
                    onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                    placeholder="Job title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select 
                    value={newEmployee.role} 
                    onValueChange={(value) => setNewEmployee({ ...newEmployee, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="educationLevel">Education Level</Label>
                  <Input
                    id="educationLevel"
                    value={newEmployee.educationLevel}
                    onChange={(e) => setNewEmployee({ ...newEmployee, educationLevel: e.target.value })}
                    placeholder="e.g. Bachelor's Degree"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gradeLevel">Grade / Level</Label>
                  <Input
                    id="gradeLevel"
                    value={newEmployee.gradeLevel}
                    onChange={(e) => setNewEmployee({ ...newEmployee, gradeLevel: e.target.value })}
                    placeholder="e.g. Senior, Level 3"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="joinDate">Join Date</Label>
                <Input
                  id="joinDate"
                  type="date"
                  value={newEmployee.joinDate}
                  onChange={(e) => setNewEmployee({ ...newEmployee, joinDate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddEmployee} className="btn-gradient">
                Add Employee
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={wrapperStyle} className="flex flex-wrap gap-4 mb-5">
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Employees</p>
                  <p className="text-xl font-bold">{employees.length}</p>
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
                  <UserPlus className="w-4 h-4 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-xl font-bold">{employees.filter(e => e.status === 'active').length}</p>
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
                  <Calendar className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">On Leave</p>
                  <p className="text-xl font-bold">{employees.filter(e => e.status === 'on_leave').length}</p>
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
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Departments</p>
                  <p className="text-xl font-bold">{departments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Filters and Search */}
      <Card style={marginStyle} className="dashboard-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4 mb-5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-full sm:min-w-[250px] md:min-w-[300px] lg:min-w-[240px]">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search departments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 w-full"
              />
            </div>

            {/* Department Filter */}
            <div className="flex-1 min-w-full sm:min-w-[250px] md:min-w-[220px] lg:min-w-[180px]">
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-full">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter Department" />
                </SelectTrigger>
                <SelectContent>
                  {["all", ...departmentNames].map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept === "all" ? "All Departments" : dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* View Mode Buttons */}
            <div className="flex space-x-4 w-full sm:w-auto justify-start sm:justify-between">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                Grid
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("table")}
              >
                Table
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Employee List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.map((employee) => (
            <Card key={employee.id} className="dashboard-card hover:shadow-card-hover transition-all duration-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={employee.profileImage || employee.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.name || '')}&background=3b82f6&color=fff`} alt={employee.name} />
                      <AvatarFallback>{(employee?.name ? employee.name.split(' ').map(n => n[0] || '').join('') : '')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-foreground">{employee.name}</h3>
                      <p className="text-sm text-muted-foreground">{employee.position} &bull; <span className="capitalize">{employee.role || 'Employee'}</span></p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(employee.status)}
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>{employee.email}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{employee.phone}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span>{employee.department}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <DollarSign className="w-4 h-4" />
                    <span>${(employee.salary ?? 0).toLocaleString()}/year</span>
                  </div>
                </div>

                 <div className="flex space-x-2 mt-4">
                   <Button 
                     variant="outline" 
                     size="sm" 
                     className="flex-1"
                     onClick={() => handleEditEmployee(employee)}
                   >
                     <Edit className="w-4 h-4 mr-2" />
                     Edit
                   </Button>
                   <Button 
                     variant="outline" 
                     size="sm" 
                     className="text-destructive hover:text-destructive"
                     onClick={() => handleDeleteEmployee(employee.id)}
                   >
                     <Trash2 className="w-4 h-4" />
                   </Button>
                 </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={employee.profileImage || employee.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.name || '')}&background=3b82f6&color=fff`} alt={employee.name} />
                        <AvatarFallback>{(employee?.name ? employee.name.split(' ').map(n => n[0] || '').join('') : '')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{employee.name}</p>
                        <p className="text-sm text-muted-foreground">{employee.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>{employee.position}</TableCell>
                  <TableCell className="capitalize">{employee.role || 'employee'}</TableCell>
                  <TableCell>${(employee.salary ?? 0).toLocaleString()}</TableCell>
                  <TableCell>{getStatusBadge(employee.status)}</TableCell>
                   <TableCell>
                     <div className="flex space-x-2">
                       <Button variant="ghost" size="sm" onClick={() => handleEditEmployee(employee)}>
                         <Edit className="w-4 h-4" />
                       </Button>
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className="text-destructive hover:text-destructive"
                         onClick={() => handleDeleteEmployee(employee.id)}
                       >
                         <Trash2 className="w-4 h-4" />
                       </Button>
                     </div>
                   </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {filteredEmployees.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No employees found</h3>
          <p className="text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Edit Employee Dialog */}
      <Dialog open={!!editingEmployee} onOpenChange={(open) => !open && setEditingEmployee(null)}>
        <DialogContent style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update employee information.</DialogDescription>
          </DialogHeader>
          {editingEmployee && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name *</Label>
                <Input
                  id="edit-name"
                  value={editingEmployee.name}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingEmployee.email}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editingEmployee.phone ?? ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-department">Department *</Label>
                  <Select 
                    value={editingEmployee?.departmentId || ''} 
                    onValueChange={(value) => setEditingEmployee({ ...editingEmployee, departmentId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-salary">Salary</Label>
                  <Input
                    id="edit-salary"
                    type="number"
                    value={editingEmployee.salary}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, salary: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-position">Position</Label>
                  <Input
                    id="edit-position"
                    value={editingEmployee.position ?? ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, position: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Role *</Label>
                  <Select 
                    value={editingEmployee.role || 'employee'} 
                    onValueChange={(value) => setEditingEmployee({ ...editingEmployee, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-educationLevel">Education Level</Label>
                  <Input
                    id="edit-educationLevel"
                    value={editingEmployee.educationLevel ?? ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, educationLevel: e.target.value })}
                    placeholder="e.g. Bachelor's Degree"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-gradeLevel">Grade / Level</Label>
                  <Input
                    id="edit-gradeLevel"
                    value={editingEmployee.gradeLevel ?? ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, gradeLevel: e.target.value })}
                    placeholder="e.g. Senior, Level 3"
                  />
                </div>
              </div>
            </div>
            </div>
          )}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setEditingEmployee(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateEmployee} className="btn-gradient">
              Update Employee
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Employees;