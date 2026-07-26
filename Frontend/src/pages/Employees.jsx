import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { exportTableExcel } from "../utils/exportExcel";
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
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
  Building2, Calendar, DollarSign, UserPlus, Users, Download,
  ChevronLeft, ChevronRight, Eye
} from 'lucide-react';
import { toast } from 'react-toastify';
import SectorCascadeFields, { getLeafUnitId } from '../components/org/SectorCascadeFields';
import WorkHistoryFields from '../components/org/WorkHistoryFields';
import { creatableRolesFor, getRoleLabel } from '../utils/permissions';
const API_URL = import.meta.env.VITE_API_URL;

const DEFAULT_BANK = "Commercial Bank of Ethiopia";

const emptyEmployeeForm = () => ({
  name: '',
  email: '',
  password: '',
  phone: '',
  departmentId: '',
  position: '',
  salary: '',
  address: '',
  role: 'employee',
  scopeLevel: 'sub_sector',
  sectorId: '',
  subSectorId: '',
  subSubSectorId: '',
  educationLevel: '',
  gradeLevel: '',
  joinDate: new Date().toISOString().split('T')[0],
  bankName: DEFAULT_BANK,
  bankAccountName: '',
  bankAccountNumber: '',
  workHistory: [],
});

const Employees = () => {
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

  const button = {
    width: "200px"
  }
  
  const navigate = useNavigate();
  const { canManage, user, canAssignOrgWide } = useAuth();

  const openEmployeeDetail = (employeeId) => {
    if (!employeeId) return;
    navigate(`/employees/${employeeId}`);
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnit, setFilterUnit] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'grid' or 'table'
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const EMPLOYEE_PAGE_SIZE = 10;
  const [employeePage, setEmployeePage] = useState(1);
  const [sectors, setSectors] = useState([]);
  const unitFilterOptions = useMemo(() => {
    const fromEmployees = employees.map((e) => e.unitPath).filter(Boolean);
    const fromSectors = sectors.map((s) =>
      Array.isArray(s.pathNames) && s.pathNames.length
        ? s.pathNames.join(' › ')
        : s.name
    ).filter(Boolean);
    return [...new Set([...fromSectors, ...fromEmployees])].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [sectors, employees]);
  const API_BASE = API_URL;
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const creatableRoles = useMemo(() => creatableRolesFor(user), [user]);

  const showOrgWideScope = canAssignOrgWide;

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        setEmployees([]);
        return;
      }
      const res = await axios.get(`${API_BASE}/api/employees`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setEmployees(list);
    } catch (err) {
      console.error(err);
      // Older API returned 404 for empty lists — treat as empty, not a hard failure
      if (err.response?.status === 404) {
        setEmployees([]);
      } else {
        setEmployees([]);
        toast.error(err.response?.data?.message || 'Failed to load employees');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch sectors for filters / cascade assignment
  const fetchSectors = async () => {
    try {
      const sectorRes = await axios.get(`${API_BASE}/api/sectors/public-list`);
      setSectors(Array.isArray(sectorRes.data?.data) ? sectorRes.data.data : []);
    } catch (err) {
      console.error(err);
      setSectors([]);
      toast.error(err.response?.data?.message || 'Failed to load sectors');
    }
  };

  const [newEmployee, setNewEmployee] = useState(emptyEmployeeForm);

  const [editingEmployee, setEditingEmployee] = useState(null);

  const filteredEmployees = employees
    .filter((employee) => {
      const q = (searchTerm || '').toLowerCase();
      const name = (employee?.name || '').toString().toLowerCase();
      const email = (employee?.email || '').toString().toLowerCase();
      const dept = (employee?.unitPath || employee?.department || '').toString().toLowerCase();
      const role = (employee?.role || '').toString().toLowerCase();

      const matchesSearch =
        q === '' || name.includes(q) || email.includes(q) || dept.includes(q) || role.includes(q);
      const unitLabel = employee?.unitPath || '';
      const matchesUnit = filterUnit === 'all' || unitLabel === filterUnit;
      return matchesSearch && matchesUnit;
    })
    .sort((a, b) =>
      String(a?.name || '').localeCompare(String(b?.name || ''), undefined, {
        sensitivity: 'base',
      })
    );

  useEffect(() => {
    setEmployeePage(1);
  }, [searchTerm, filterUnit, employees.length]);

  const employeeTotalPages = Math.max(1, Math.ceil(filteredEmployees.length / EMPLOYEE_PAGE_SIZE));
  const safeEmployeePage = Math.min(employeePage, employeeTotalPages);
  const employeePageStart = (safeEmployeePage - 1) * EMPLOYEE_PAGE_SIZE;
  const pagedEmployees = filteredEmployees.slice(
    employeePageStart,
    employeePageStart + EMPLOYEE_PAGE_SIZE
  );
  const employeeHasPrev = safeEmployeePage > 1;
  const employeeHasNext = safeEmployeePage < employeeTotalPages;

  const handleAddEmployee = async () => {
    const isOrgWide =
      ['superadmin', 'admin', 'hr'].includes(newEmployee.role) ||
      newEmployee.scopeLevel === 'organization';
    const isSectorLead = newEmployee.role === 'sector_lead';
    const isManagerRole = newEmployee.role === 'manager';
    const isUnitManagerRole = newEmployee.role === 'unit_manager';
    const leafUnitId = getLeafUnitId(newEmployee);
    if (!newEmployee.name || !newEmployee.email || !newEmployee.password) {
      toast.error('Please fill in name, email, and password');
      return;
    }
    if (isSectorLead && !newEmployee.sectorId) {
      toast.error('Sector Lead must be assigned to a sector');
      return;
    }
    if (isManagerRole && !newEmployee.subSectorId) {
      toast.error('Manager must be assigned to a sub-sector');
      return;
    }
    if (isUnitManagerRole && !newEmployee.subSubSectorId) {
      toast.error('Unit Manager must be assigned to a sub-sub-sector');
      return;
    }
    if (!isOrgWide && !isSectorLead && !leafUnitId && !newEmployee.departmentId) {
      toast.error('Please select a sector / sub-sector assignment');
      return;
    }
    try {
      const payload = {
        name: newEmployee.name,
        email: newEmployee.email,
        password: newEmployee.password,
        phone: newEmployee.phone,
        leafUnitId: isOrgWide || isSectorLead ? undefined : leafUnitId || undefined,
        sectorId: isOrgWide ? undefined : newEmployee.sectorId || undefined,
        subSectorId: isOrgWide || isSectorLead ? undefined : newEmployee.subSectorId || undefined,
        subSubSectorId:
          isOrgWide || isSectorLead ? undefined : newEmployee.subSubSectorId || undefined,
        scopeLevel: isSectorLead ? 'sector' : isOrgWide ? 'organization' : newEmployee.scopeLevel,
        departmentId: leafUnitId || isOrgWide ? undefined : newEmployee.departmentId || undefined,
        position: newEmployee.position,
        salary: newEmployee.salary ? Number(newEmployee.salary) : undefined,
        address: newEmployee.address,
        role: newEmployee.role,
        educationLevel: newEmployee.educationLevel,
        gradeLevel: newEmployee.gradeLevel,
        joinDate: newEmployee.joinDate,
        status: 'active',
        bankName: newEmployee.bankName || DEFAULT_BANK,
        bankAccountName: newEmployee.bankAccountName || newEmployee.name || "",
        bankAccountNumber: newEmployee.bankAccountNumber || "",
        workHistory: (newEmployee.workHistory || []).filter((w) => (w.company || "").trim()),
      };
      const res = await axios.post(`${API_BASE}/api/employees/create`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const created = res.data?.data;
      if (!created) throw new Error('No employee returned');
      setEmployees(prev => [...prev, created]);
      setNewEmployee(emptyEmployeeForm());
      setShowAddDialog(false);
      if (res.data?.emailSent) {
        toast.success(res.data?.emailNotice || 'User added and welcome email queued.');
      } else {
        toast.warning(
          res.data?.emailNotice ||
            'User added, but the welcome email could not be sent.'
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to add employee');
    }
  };

  const toId = (val) => {
    if (!val) return '';
    if (typeof val === 'object') return val._id || val.id || '';
    return String(val);
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee({
      ...employee,
      departmentId: employee.departmentId || '',
      role: employee.role || 'employee',
      scopeLevel: employee.scopeLevel || 'sub_sector',
      sectorId: toId(employee.sectorId),
      subSectorId: toId(employee.subSectorId),
      subSubSectorId: toId(employee.subSubSectorId),
      educationLevel: employee.education?.[0]?.degree || '',
      gradeLevel: employee.gradeLevel || '',
      salary: employee?.salary != null ? String(employee.salary) : '',
      bankName: employee?.bankName || DEFAULT_BANK,
      bankAccountName: employee?.bankAccountName || employee?.name || '',
      bankAccountNumber: employee?.bankAccountNumber || '',
      workHistory:
        Array.isArray(employee.workHistory) && employee.workHistory.length > 0
          ? employee.workHistory.map((w) => ({
              company: w.company || '',
              position: w.position || '',
              startDate: w.startDate || '',
              endDate: w.endDate || '',
              description: w.description || '',
            }))
          : [],
    });
  };

  const handleUpdateEmployee = async () => {
    const isOrgWide =
      ['superadmin', 'admin', 'hr'].includes(editingEmployee.role) ||
      editingEmployee.scopeLevel === 'organization';
    const isSectorLead = editingEmployee.role === 'sector_lead';
    const isManagerRole = editingEmployee.role === 'manager';
    const isUnitManagerRole = editingEmployee.role === 'unit_manager';
    const leafUnitId = getLeafUnitId(editingEmployee);
    if (!editingEmployee.name || !editingEmployee.email) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (isSectorLead && !editingEmployee.sectorId) {
      toast.error('Sector Lead must be assigned to a sector');
      return;
    }
    if (isManagerRole && !editingEmployee.subSectorId) {
      toast.error('Manager must be assigned to a sub-sector');
      return;
    }
    if (isUnitManagerRole && !editingEmployee.subSubSectorId) {
      toast.error('Unit Manager must be assigned to a sub-sub-sector');
      return;
    }
    if (!isOrgWide && !isSectorLead && !leafUnitId && !editingEmployee.departmentId) {
      toast.error('Please select a sector / sub-sector assignment');
      return;
    }
    try {
      const payload = {
        name: editingEmployee.name,
        email: editingEmployee.email,
        phone: editingEmployee.phone,
        leafUnitId: isOrgWide || isSectorLead ? undefined : leafUnitId || undefined,
        sectorId: isOrgWide ? undefined : editingEmployee.sectorId || undefined,
        subSectorId:
          isOrgWide || isSectorLead ? undefined : editingEmployee.subSectorId || undefined,
        subSubSectorId:
          isOrgWide || isSectorLead ? undefined : editingEmployee.subSubSectorId || undefined,
        scopeLevel: isSectorLead
          ? 'sector'
          : isOrgWide
            ? 'organization'
            : editingEmployee.scopeLevel,
        departmentId: leafUnitId || isOrgWide ? undefined : editingEmployee.departmentId || undefined,
        position: editingEmployee.position,
        role: editingEmployee.role,
        educationLevel: editingEmployee.educationLevel,
        gradeLevel: editingEmployee.gradeLevel,
        salary: editingEmployee.salary ? Number(editingEmployee.salary) : undefined,
        bankName: editingEmployee.bankName || DEFAULT_BANK,
        bankAccountName: editingEmployee.bankAccountName || "",
        bankAccountNumber: editingEmployee.bankAccountNumber || "",
        workHistory: (editingEmployee.workHistory || []).filter((w) => (w.company || "").trim()),
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

    const RETIREMENT_AGE = 60;

    /** Completed years of service from join date to today */
    const calcServiceYears = (joinDateStr) => {
      if (!joinDateStr) return '';
      const join = new Date(joinDateStr);
      if (Number.isNaN(join.getTime())) return '';
      const now = new Date();
      let years = now.getFullYear() - join.getFullYear();
      const monthDiff = now.getMonth() - join.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < join.getDate())) {
        years -= 1;
      }
      return Math.max(0, years);
    };

    /** Calendar year when employee reaches retirement age (DOB year + 60) */
    const calcRetirementYear = (dobStr) => {
      if (!dobStr) return '';
      const dob = new Date(dobStr);
      if (Number.isNaN(dob.getTime())) return '';
      return dob.getFullYear() + RETIREMENT_AGE;
    };

    const headers = [
      'No',
      'Name',
      'Gender',
      'Date of Birth',
      'Education Level',
      'Job Title',
      'Unit / Sector',
      'Date of Joining',
      'Salary',
      'Grade / Level',
      'Service Year',
      'Retirement Year',
      'National ID',
      'Phone Number',
      'Emergency Contact',
      'Emergency Contact Phone',
      'Bank',
      'Account Name',
      'Account Number',
    ];

    const rows = employees.map((emp, index) => {
      const joinDate = emp.joinDate || emp.createdAt || '';
      const serviceYear = calcServiceYears(joinDate);
      const retirementYear = calcRetirementYear(emp.dateOfBirth);
      const educationStr =
        Array.isArray(emp.education) && emp.education.length > 0
          ? `${emp.education[0].degree || ''} ${emp.education[0].fieldOfStudy || ''}`.trim()
          : emp.educationLevel || '';

      return [
        index + 1,
        emp.name || '',
        emp.gender === 'M' ? 'Male' : emp.gender === 'F' ? 'Female' : emp.gender || '',
        emp.dateOfBirth || '',
        educationStr,
        emp.position || '',
        emp.unitPath || emp.department || '',
        joinDate,
        Number(emp.salary) || emp.salary || '',
        emp.gradeLevel || '',
        serviceYear,
        retirementYear,
        emp.nationalId || '',
        emp.phone || '',
        emp.emergencyContact || '',
        emp.emergencyPhone || '',
        emp.bankName || 'Commercial Bank of Ethiopia',
        emp.bankAccountName || emp.name || '',
        emp.bankAccountNumber || '',
      ];
    });

    exportTableExcel({
      title: 'Gamo Development Association — Employee Profile Report',
      subtitle: `Exported ${new Date().toLocaleDateString()} · ${employees.length} employee(s)`,
      headers,
      rows,
      sheetName: 'Employees',
      filename: 'GaDA-Employee-Profiles.xlsx',
    });

    const incomplete = employees.filter(
      (emp) =>
        !emp.gradeLevel ||
        !emp.nationalId ||
        !emp.emergencyContact ||
        !emp.emergencyPhone ||
        !emp.dateOfBirth ||
        !(emp.education?.length > 0 || emp.educationLevel) ||
        !emp.bankAccountNumber
    ).length;

    toast.success(`Exported ${employees.length} employee(s) to Excel`);
    if (incomplete > 0) {
      toast.warn(
        `${incomplete} employee(s) have incomplete profile data (education, grade, national ID, emergency contact, or bank account).`
      );
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
    fetchSectors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canManage) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">Only managers, HR, and admins can access employee management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('pages.employees')}</h1>
          <p className="text-muted-foreground">{t('pages.employeesDesc')}</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={handleExportExcel} style={{ ...marginStyle, ...button }} className="border-primary text-primary hover:bg-primary/10">
            <Download className="w-4 h-4 mr-2" />
            {t('common.export')}
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild style={{ ...marginStyle, ...button }}>
              <Button className="btn-gradient">
                <UserPlus className="w-4 h-4 mr-2" />
                {t('pages.addEmployee')}
              </Button>
            </DialogTrigger>
          <DialogContent style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <DialogHeader>
              <DialogTitle>{t('pages.addEmployee')}</DialogTitle>
              <DialogDescription>{t('pages.employeesDesc')}</DialogDescription>
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
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={newEmployee.role}
                    onValueChange={(value) => {
                      const next = { ...newEmployee, role: value };
                      if (['superadmin', 'admin', 'hr'].includes(value)) {
                        next.scopeLevel = 'organization';
                        next.sectorId = '';
                        next.subSectorId = '';
                        next.subSubSectorId = '';
                      } else if (value === 'sector_lead') {
                        next.scopeLevel = 'sector';
                        next.subSectorId = '';
                        next.subSubSectorId = '';
                      } else if (value === 'manager') {
                        next.scopeLevel = 'sub_sector';
                        next.subSubSectorId = '';
                      } else if (value === 'unit_manager') {
                        next.scopeLevel = 'sub_sub_sector';
                      }
                      setNewEmployee(next);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {creatableRoles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {getRoleLabel(r)}
                        </SelectItem>
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

              <SectorCascadeFields
                sectors={sectors}
                unitDepth={
                  newEmployee.role === 'manager'
                    ? 'sub_sector'
                    : newEmployee.role === 'unit_manager'
                      ? 'sub_sub_sector'
                      : null
                }
                showOrgWide={
                  showOrgWideScope &&
                  ['superadmin', 'admin', 'hr'].includes(newEmployee.role)
                }
                value={{
                  scopeLevel: newEmployee.scopeLevel,
                  sectorId: newEmployee.sectorId,
                  subSectorId: newEmployee.subSectorId,
                  subSubSectorId: newEmployee.subSubSectorId,
                }}
                onChange={(org) => {
                  if (newEmployee.role === 'sector_lead') {
                    setNewEmployee({
                      ...newEmployee,
                      ...org,
                      scopeLevel: 'sector',
                      subSectorId: '',
                      subSubSectorId: '',
                    });
                    return;
                  }
                  if (newEmployee.role === 'manager') {
                    setNewEmployee({
                      ...newEmployee,
                      ...org,
                      scopeLevel: 'sub_sector',
                      subSubSectorId: '',
                    });
                    return;
                  }
                  if (newEmployee.role === 'unit_manager') {
                    setNewEmployee({
                      ...newEmployee,
                      ...org,
                      scopeLevel: 'sub_sub_sector',
                    });
                    return;
                  }
                  setNewEmployee({ ...newEmployee, ...org });
                }}
              />

              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={newEmployee.position}
                  onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                  placeholder="Job title"
                />
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
              <WorkHistoryFields
                idPrefix="new-work"
                value={newEmployee.workHistory || []}
                onChange={(workHistory) => setNewEmployee({ ...newEmployee, workHistory })}
              />
              <div className="space-y-2">
                <Label htmlFor="joinDate">Join Date</Label>
                <Input
                  id="joinDate"
                  type="date"
                  value={newEmployee.joinDate}
                  onChange={(e) => setNewEmployee({ ...newEmployee, joinDate: e.target.value })}
                />
              </div>
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">Bank payment details</p>
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank</Label>
                  <Input
                    id="bankName"
                    value={newEmployee.bankName || DEFAULT_BANK}
                    onChange={(e) => setNewEmployee({ ...newEmployee, bankName: e.target.value })}
                    placeholder={DEFAULT_BANK}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankAccountName">Account name</Label>
                  <Input
                    id="bankAccountName"
                    value={newEmployee.bankAccountName}
                    onChange={(e) => setNewEmployee({ ...newEmployee, bankAccountName: e.target.value })}
                    placeholder="Name on the bank account"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankAccountNumber">Account number</Label>
                  <Input
                    id="bankAccountNumber"
                    value={newEmployee.bankAccountNumber}
                    onChange={(e) => setNewEmployee({ ...newEmployee, bankAccountNumber: e.target.value })}
                    placeholder="CBE account number"
                  />
                </div>
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
                  <p className="text-sm text-muted-foreground">{t('employees.totalEmployees')}</p>
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
                  <p className="text-sm text-muted-foreground">{t('employees.activeEmployees')}</p>
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
                  <p className="text-sm text-muted-foreground">{t('pages.onLeave')}</p>
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
                  <p className="text-sm text-muted-foreground">Sectors / Units</p>
                  <p className="text-xl font-bold">{sectors.length}</p>
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
                placeholder={t('pages.searchEmployees')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 w-full"
              />
            </div>

            {/* Unit / Sector Filter */}
            <div className="flex-1 min-w-full sm:min-w-[250px] md:min-w-[220px] lg:min-w-[180px]">
              <Select value={filterUnit} onValueChange={setFilterUnit}>
                <SelectTrigger className="w-full">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by Unit / Sector" />
                </SelectTrigger>
                <SelectContent>
                  {["all", ...unitFilterOptions].map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit === "all" ? "All Units / Sectors" : unit}
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
        <div className="space-y-4">
          {filteredEmployees.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing {Math.min(employeePageStart + 1, filteredEmployees.length)}–
              {Math.min(employeePageStart + EMPLOYEE_PAGE_SIZE, filteredEmployees.length)} of{' '}
              {filteredEmployees.length} (A–Z by name)
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pagedEmployees.map((employee) => (
            <Card
              key={employee.id}
              className="dashboard-card hover:shadow-card-hover transition-all duration-200 cursor-pointer"
              onClick={() => openEmployeeDetail(employee.id)}
            >
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
                    <span>{employee.unitPath || employee.department || '—'}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <DollarSign className="w-4 h-4" />
                    <span>${(employee.salary ?? 0).toLocaleString()}/year</span>
                  </div>
                </div>

                 <div className="flex space-x-2 mt-4" onClick={(e) => e.stopPropagation()}>
                   <Button 
                     variant="outline" 
                     size="sm" 
                     className="flex-1"
                     onClick={() => openEmployeeDetail(employee.id)}
                   >
                     <Eye className="w-4 h-4 mr-2" />
                     View
                   </Button>
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
          {filteredEmployees.length > EMPLOYEE_PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!employeeHasPrev}
                onClick={() => setEmployeePage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <p className="text-sm text-muted-foreground">
                Page {safeEmployeePage} of {employeeTotalPages}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!employeeHasNext}
                onClick={() => setEmployeePage((p) => Math.min(employeeTotalPages, p + 1))}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Card className="data-table">
          <div className="px-4 pt-4 text-sm text-muted-foreground">
            {filteredEmployees.length > 0
              ? `Showing ${Math.min(employeePageStart + 1, filteredEmployees.length)}–${Math.min(
                  employeePageStart + EMPLOYEE_PAGE_SIZE,
                  filteredEmployees.length
                )} of ${filteredEmployees.length} (A–Z by name)`
              : null}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Unit / Sector</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedEmployees.map((employee) => (
                <TableRow
                  key={employee.id}
                  className="cursor-pointer"
                  onClick={() => openEmployeeDetail(employee.id)}
                >
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={employee.profileImage || employee.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.name || '')}&background=3b82f6&color=fff`} alt={employee.name} />
                        <AvatarFallback>{(employee?.name ? employee.name.split(' ').map(n => n[0] || '').join('') : '')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-primary hover:underline">{employee.name}</p>
                        <p className="text-sm text-muted-foreground">{employee.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate" title={employee.unitPath || employee.department || ''}>
                    {employee.unitPath || employee.department || '—'}
                  </TableCell>
                  <TableCell>{employee.position}</TableCell>
                  <TableCell className="capitalize">
                    {(employee.role || 'employee').replace('superadmin', 'Super Admin')}
                  </TableCell>
                  <TableCell>${(employee.salary ?? 0).toLocaleString()}</TableCell>
                  <TableCell>{getStatusBadge(employee.status)}</TableCell>
                   <TableCell>
                     <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                       <Button
                         variant="ghost"
                         size="sm"
                         title="View details"
                         onClick={() => openEmployeeDetail(employee.id)}
                       >
                         <Eye className="w-4 h-4" />
                       </Button>
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
          {filteredEmployees.length > EMPLOYEE_PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 p-4 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!employeeHasPrev}
                onClick={() => setEmployeePage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <p className="text-sm text-muted-foreground">
                Page {safeEmployeePage} of {employeeTotalPages}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!employeeHasNext}
                onClick={() => setEmployeePage((p) => Math.min(employeeTotalPages, p + 1))}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </Card>
      )}

      {filteredEmployees.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('employees.noEmployees')}</h3>
          <p className="text-muted-foreground">{t('common.noResults')}</p>
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
                  <Label htmlFor="edit-role">Role *</Label>
                  <Select
                    value={editingEmployee.role || 'employee'}
                    onValueChange={(value) => {
                      const next = { ...editingEmployee, role: value };
                      if (['superadmin', 'admin', 'hr'].includes(value)) {
                        next.scopeLevel = 'organization';
                        next.sectorId = '';
                        next.subSectorId = '';
                        next.subSubSectorId = '';
                      } else if (value === 'sector_lead') {
                        next.scopeLevel = 'sector';
                        next.subSectorId = '';
                        next.subSubSectorId = '';
                      } else if (value === 'manager') {
                        next.scopeLevel = 'sub_sector';
                        next.subSubSectorId = '';
                      } else if (value === 'unit_manager') {
                        next.scopeLevel = 'sub_sub_sector';
                      }
                      setEditingEmployee(next);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {creatableRoles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {getRoleLabel(r)}
                        </SelectItem>
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
                <div>
                  <Label>Bank</Label>
                  <Input
                    value={editingEmployee.bankName || DEFAULT_BANK}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, bankName: e.target.value })
                    }
                    placeholder={DEFAULT_BANK}
                  />
                </div>
                <div>
                  <Label>Account name</Label>
                  <Input
                    value={editingEmployee.bankAccountName || ""}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        bankAccountName: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Account number</Label>
                  <Input
                    value={editingEmployee.bankAccountNumber || ""}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        bankAccountNumber: e.target.value,
                      })
                    }
                    placeholder="CBE account number"
                  />
                </div>
              </div>

              <SectorCascadeFields
                sectors={sectors}
                unitDepth={
                  editingEmployee.role === 'manager'
                    ? 'sub_sector'
                    : editingEmployee.role === 'unit_manager'
                      ? 'sub_sub_sector'
                      : null
                }
                showOrgWide={
                  showOrgWideScope &&
                  ['superadmin', 'admin', 'hr'].includes(editingEmployee.role)
                }
                value={{
                  scopeLevel: editingEmployee.scopeLevel || 'sub_sector',
                  sectorId: editingEmployee.sectorId || '',
                  subSectorId: editingEmployee.subSectorId || '',
                  subSubSectorId: editingEmployee.subSubSectorId || '',
                }}
                onChange={(org) => {
                  if (editingEmployee.role === 'sector_lead') {
                    setEditingEmployee({
                      ...editingEmployee,
                      ...org,
                      scopeLevel: 'sector',
                      subSectorId: '',
                      subSubSectorId: '',
                    });
                    return;
                  }
                  if (editingEmployee.role === 'manager') {
                    setEditingEmployee({
                      ...editingEmployee,
                      ...org,
                      scopeLevel: 'sub_sector',
                      subSubSectorId: '',
                    });
                    return;
                  }
                  if (editingEmployee.role === 'unit_manager') {
                    setEditingEmployee({
                      ...editingEmployee,
                      ...org,
                      scopeLevel: 'sub_sub_sector',
                    });
                    return;
                  }
                  setEditingEmployee({ ...editingEmployee, ...org });
                }}
              />

              <div className="space-y-2">
                <Label htmlFor="edit-position">Position</Label>
                <Input
                  id="edit-position"
                  value={editingEmployee.position ?? ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, position: e.target.value })}
                />
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
              <WorkHistoryFields
                idPrefix="edit-work"
                value={editingEmployee.workHistory || []}
                onChange={(workHistory) => setEditingEmployee({ ...editingEmployee, workHistory })}
              />
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