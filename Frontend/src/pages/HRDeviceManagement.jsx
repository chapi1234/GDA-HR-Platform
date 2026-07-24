import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import {
  Laptop, Tablet, Smartphone, Monitor, Plus, Search,
  Edit, Trash2, UserPlus, Calendar, MapPin, AlertCircle, RotateCw
} from 'lucide-react';
import axios from 'axios';
import { useClientPagination } from '../hooks/useClientPagination';
import ListPagination from '../components/ListPagination';

const API_BASE = import.meta.env.VITE_API_URL || '';

const HRDeviceManagement = () => {
  // NOTE: Removed hard-coded mock employees and devices. The component now
  // relies on the API calls in useEffect to populate `devices` and
  // `employeesList`. This prevents showing dummy/mock users when assigning devices.

  // State management
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [isEditDeviceOpen, setIsEditDeviceOpen] = useState(false);
  const [isCreateDeviceOpen, setIsCreateDeviceOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  // start with empty arrays; useEffect will populate these from the API
  const [devices, setDevices] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // assign form state
  const [assignForm, setAssignForm] = useState({ employeeId: '', deviceId: '', location: '', notes: '' });
  // create device form
  const [createForm, setCreateForm] = useState({ name: '', type: 'laptop', brand: '', model: '', serialNumber: '', ram: '', storage: '', purchaseDate: '', condition: 'excellent', notes: '' });

  // Normalize devices coming from server to a consistent shape for the UI
  const normalizeDevice = (d) => {
    const id = d._id || d.id;
    const deviceName = d.deviceName || d.name || '';
    const deviceType = d.deviceType || d.type || '';
    const model = d.model || '';
    const serialNumber = d.serialNumber || d.serial || '';
    const ram = d.ram || '';
    const storage = d.storage || '';
    const employeeId = d.employeeId || (d.assignedTo && (d.assignedTo._id || d.assignedTo)) || null;
    const employeeName = d.employeeName || (d.assignedTo && d.assignedTo.name) || (employeesList.find(e => String(e._id || e.id) === String(employeeId)) || {}).name || '';
    const assignedDate = d.assignedDate || d.assignedAt || d.assignedOn || d.assigned || null;
    const status = d.status || 'available';
    const location = d.location || '';
    const condition = d.condition || 'good';
    return { id, deviceName, deviceType, model, serialNumber, ram, storage, employeeId, employeeName, assignedDate, status, location, condition, raw: d };
  };

  const normalizedDevices = (devices || []).map(normalizeDevice);
  const availableFromState = normalizedDevices.filter(d => d.status === 'available');

  const filteredAssignments = normalizedDevices.filter(device =>
    (String(device.deviceName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(device.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(device.serialNumber || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const assignmentsPaging = useClientPagination(filteredAssignments, 10, [
    searchTerm,
    devices.length,
  ]);
  const availablePaging = useClientPagination(availableFromState, 10, [
    devices.length,
  ]);
  const employeesPaging = useClientPagination(employeesList, 10, [
    employeesList.length,
  ]);

  const getEmployeeDevices = (employeeId) => {
    return normalizedDevices.filter(device => String(device.employeeId || '') === String(employeeId));
  };

  const getDeviceIcon = (type) => {
    switch (type) {
      case 'laptop':
        return Laptop;
      case 'tablet':
        return Tablet;
      case 'phone':
        return Smartphone;
      case 'monitor':
        return Monitor;
      default:
        return Laptop;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'maintenance':
        return 'warning';
      case 'available':
        return 'secondary';
      case 'returned':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getConditionColor = (condition) => {
    switch (condition) {
      case 'excellent':
        return 'bg-success text-success-foreground';
      case 'good':
        return 'bg-primary text-primary-foreground';
      case 'fair':
        return 'bg-warning text-warning-foreground';
      case 'poor':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const handleEditDevice = (device) => {
    setEditingDevice(device);
    setIsEditDeviceOpen(true);
  };

  const handleOpenReassign = (device) => {
    const deviceId = device._id || device.id || device.id;
    // open assign dialog and prefill the device id so HR can pick a new employee
    setAssignForm(prev => ({ ...prev, deviceId: String(deviceId), employeeId: '' }));
    setIsAddDeviceOpen(true);
  };


  const handleUpdateDevice = (updatedDevice) => {
    // call backend to update
    const token = localStorage.getItem('authToken');
    axios.put(`${API_BASE}/api/devices/${updatedDevice._id || updatedDevice.id}`, updatedDevice, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        const data = res.data?.data || res.data;
        setDevices(prev => prev.map(d => (String(d._id || d.id) === String(data._id || data.id) ? data : d)));
        setIsEditDeviceOpen(false);
        setEditingDevice(null);
      })
      .catch(err => {
        console.error('Failed to update device', err);
        // fallback local update
        setDevices(devices.map(device => device.id === updatedDevice.id ? updatedDevice : device));
        setIsEditDeviceOpen(false);
        setEditingDevice(null);
      });
  };

  // Fetch devices and employees from backend
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    setLoadingDevices(true);
    axios.get(`${API_BASE}/api/devices/me`, { headers })
      .then(res => {
        const payload = res.data?.data || res.data;
        if (Array.isArray(payload)) setDevices(payload);
      })
      .catch(err => {
        console.error('Failed to load devices', err);
      })
      .finally(() => setLoadingDevices(false));

    // include auth headers like other pages (backend expects authenticated request)
    axios.get(`${API_BASE}/api/employees`, { headers })
      .then(res => {
        const payload = res.data?.data || res.data;
        if (Array.isArray(payload)) setEmployeesList(payload);
      })
      .catch(err => console.error('Failed to load employees', err));
  }, []);

  const refreshDevices = () => {
    const token = localStorage.getItem('authToken');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    axios.get(`${API_BASE}/api/devices/me`, { headers })
      .then(res => {
        const payload = res.data?.data || res.data;
        if (Array.isArray(payload)) setDevices(payload);
      })
      .catch(err => console.error('Failed to refresh devices', err));
  };

  const handleAssignSubmit = async () => {
    const token = localStorage.getItem('authToken');
    try {
      const body = { employeeId: assignForm.employeeId, assignedDate: assignForm.assignedDate, location: assignForm.location, notes: assignForm.notes };
      const deviceId = assignForm.deviceId;
      await axios.post(`${API_BASE}/api/devices/${deviceId}/assign`, body, { headers: { Authorization: `Bearer ${token}` } });
      setIsAddDeviceOpen(false);
      setAssignForm({ employeeId: '', deviceId: '', location: '', notes: '' });
      refreshDevices();
    } catch (err) {
      console.error('Failed to assign device', err);
    }
  };

  const handleReturnDevice = async (deviceId) => {
    const token = localStorage.getItem('authToken');
    try {
      await axios.post(`${API_BASE}/api/devices/${deviceId}/return`, {}, { headers: { Authorization: `Bearer ${token}` } });
      refreshDevices();
    } catch (err) {
      console.error('Failed to return device', err);
    }
  };

  const handleCreateDevice = async () => {
    const token = localStorage.getItem('authToken');
    try {
      const body = { name: createForm.name, type: createForm.type, brand: createForm.brand, model: createForm.model, serialNumber: createForm.serialNumber, ram: createForm.ram, storage: createForm.storage, purchaseDate: createForm.purchaseDate, condition: createForm.condition, notes: createForm.notes };
      await axios.post(`${API_BASE}/api/devices`, body, { headers: { Authorization: `Bearer ${token}` } });
      setIsCreateDeviceOpen(false);
      setCreateForm({ name: '', type: 'laptop', brand: '', model: '', serialNumber: '', ram: '', storage: '', purchaseDate: '', condition: 'excellent', notes: '' });
      refreshDevices();
    } catch (err) {
      console.error('Failed to create device', err);
    }
  };

  const handleDeleteDeviceRemote = async (deviceId) => {
    const token = localStorage.getItem('authToken');
    try {
      await axios.delete(`${API_BASE}/api/devices/${deviceId}`, { headers: { Authorization: `Bearer ${token}` } });
      setDevices(prev => prev.filter(d => String(d._id || d.id) !== String(deviceId)));
    } catch (err) {
      console.error('Failed to delete device', err);
      // fallback: local delete
      setDevices(prev => prev.filter(d => String(d._id || d.id) !== String(deviceId)));
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="bg-gradient-hero rounded-2xl p-8 text-black dark:text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Device Management</h1>
            <p className="text-primary-foreground/90">Manage and track company device assignments</p>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
              <div className="text-2xl font-bold">{normalizedDevices.filter(d => d.status !== 'available').length}</div>
              <div className="text-sm text-primary-foreground/80">Assigned</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
              <div className="text-2xl font-bold">{availableFromState.length}</div>
              <div className="text-sm text-primary-foreground/80">Available</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search devices, employees, or serial numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateDeviceOpen} onOpenChange={setIsCreateDeviceOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Create New Device
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Device</DialogTitle>
                <DialogDescription>
                  Add a new device to the company inventory.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="deviceName">Device Name</Label>
                  <Input placeholder="e.g., MacBook Pro 16" value={createForm.name} onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deviceType">Device Type</Label>
                  <Select value={createForm.type} onValueChange={(v) => setCreateForm(prev => ({ ...prev, type: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select device type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="laptop">Laptop</SelectItem>
                      <SelectItem value="tablet">Tablet</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="monitor">Monitor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input placeholder="e.g., MacBook Pro M2" value={createForm.model} onChange={(e) => setCreateForm(prev => ({ ...prev, model: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input placeholder="e.g., MBP2023001" value={createForm.serialNumber} onChange={(e) => setCreateForm(prev => ({ ...prev, serialNumber: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ram">RAM</Label>
                  <Input placeholder="e.g., 16GB, 32GB" value={createForm.ram} onChange={(e) => setCreateForm(prev => ({ ...prev, ram: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storage">Storage</Label>
                  <Input placeholder="e.g., 512GB SSD, 1TB SSD" value={createForm.storage} onChange={(e) => setCreateForm(prev => ({ ...prev, storage: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condition">Condition</Label>
                  <Select value={createForm.condition} onValueChange={(v) => setCreateForm(prev => ({ ...prev, condition: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDeviceOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => handleCreateDevice()}>
                  Create Device
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddDeviceOpen} onOpenChange={setIsAddDeviceOpen}>
            <DialogTrigger asChild>
              <Button className="btn-gradient">
                <Plus className="w-4 h-4 mr-2" />
                Assign Device
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Assign Device to Employee</DialogTitle>
              <DialogDescription>
                Select an employee and device to create a new assignment.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="employee">Employee</Label>
                <Select value={assignForm.employeeId} onValueChange={(v) => setAssignForm(prev => ({ ...prev, employeeId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeesList.map((employee) => {
                      const empId = employee._id || employee.id;
                      return (
                        <SelectItem key={empId} value={String(empId)}>
                          {employee.name} - {employee.department}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="device">Available Device</Label>
                <Select value={assignForm.deviceId} onValueChange={(v) => setAssignForm(prev => ({ ...prev, deviceId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFromState.map((device) => (
                      <SelectItem key={device.id} value={device.id}>
                        {device.deviceName || device.raw?.name} - {device.serialNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input placeholder="Office location or desk number" value={assignForm.location} onChange={(e) => setAssignForm(prev => ({ ...prev, location: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea placeholder="Any additional notes about this assignment..." value={assignForm.notes} onChange={(e) => setAssignForm(prev => ({ ...prev, notes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDeviceOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleAssignSubmit()}>
                Assign Device
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>

        {/* Edit Device Dialog */}
        <Dialog open={isEditDeviceOpen} onOpenChange={setIsEditDeviceOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Device Assignment</DialogTitle>
              <DialogDescription>
                Update device information and assignment details.
              </DialogDescription>
            </DialogHeader>
            {editingDevice && (
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="deviceName">Device Name</Label>
                  <Input 
                    defaultValue={editingDevice.deviceName}
                    placeholder="Enter device name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input 
                    defaultValue={editingDevice.model}
                    placeholder="Enter device model"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input 
                    defaultValue={editingDevice.serialNumber}
                    placeholder="Enter serial number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ram">RAM</Label>
                  <Input 
                    defaultValue={editingDevice.ram}
                    placeholder="e.g., 16GB, 32GB"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storage">Storage</Label>
                  <Input 
                    defaultValue={editingDevice.storage}
                    placeholder="e.g., 512GB SSD, 1TB SSD"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input 
                    defaultValue={editingDevice.location}
                    placeholder="Office location or desk number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select defaultValue={editingDevice.status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condition">Condition</Label>
                  <Select defaultValue={editingDevice.condition}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDeviceOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                // In a real app, you'd get values from form inputs
                handleUpdateDevice(editingDevice);
              }}>
                Update Device
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="all-devices" className="space-y-6">
        <TabsList className="flex flex-wrap w-full gap-2 mb-6">
          <TabsTrigger value="all-devices">All Devices</TabsTrigger>
          <TabsTrigger value="by-employee">By Employee</TabsTrigger>
          <TabsTrigger value="available">Available Devices</TabsTrigger>
        </TabsList>

        {/* All Devices Tab */}
        <TabsContent value="all-devices" className="space-y-6">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Laptop className="w-5 h-5 text-primary" />
                <span>All Device Assignments</span>
              </CardTitle>
              <CardDescription>
                Overview of all company devices and their current assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assignmentsPaging.pagedItems.map((device) => {
                  const DeviceIcon = getDeviceIcon(device.deviceType);
                  return (
                    <div 
                      key={device.id} 
                      className="flex flex-col md:flex-row md:items-center md:justify-between p-4 rounded-lg border hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-accent rounded-lg">
                          <DeviceIcon className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg">{device.deviceName}</h4>
                          <p className="text-muted-foreground">{device.model} • {device.serialNumber}</p>
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between items-center space-x-4 mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <UserPlus className="w-4 h-4" />
                              <span>{device.employeeName}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>Assigned: {new Date(device.assignedDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-4 h-4" />
                              <span>{device.location}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge 
                          className={getConditionColor(device.condition)}
                        >
                          {device.condition}
                        </Badge>
                        <Badge variant={getStatusColor(device.status)}>
                          {device.status}
                        </Badge>
                        <div className="flex items-center space-x-2">
                          {device.status !== 'available' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReturnDevice(device.id)}
                              title="Mark returned"
                            >
                              <RotateCw className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditDevice(device)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive"
                            onClick={() => handleDeleteDeviceRemote(device.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {assignmentsPaging.showControls && (
                  <ListPagination
                    page={assignmentsPaging.page}
                    totalPages={assignmentsPaging.totalPages}
                    hasPrev={assignmentsPaging.hasPrev}
                    hasNext={assignmentsPaging.hasNext}
                    rangeLabel={assignmentsPaging.rangeLabel}
                    onPrev={() =>
                      assignmentsPaging.setPage((p) => Math.max(1, p - 1))
                    }
                    onNext={() =>
                      assignmentsPaging.setPage((p) =>
                        Math.min(assignmentsPaging.totalPages, p + 1)
                      )
                    }
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Employee Tab */}
        <TabsContent value="by-employee" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {employeesPaging.pagedItems.map((employee) => {
              const empId = employee._id || employee.id;
              const employeeDevices = getEmployeeDevices(empId);
              return (
                <Card key={empId} className="dashboard-card">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={`https://ui-avatars.com/api/?name=${employee.name}&background=3b82f6&color=fff`} />
                        <AvatarFallback>{employee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{employee.name}</h3>
                        <p className="text-sm text-muted-foreground">{employee.department}</p>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {employeeDevices.length > 0 ? (
                      <div className="space-y-3">
                        {employeeDevices.map((device) => {
                          const DeviceIcon = getDeviceIcon(device.deviceType);
                          return (
                            <div key={device.id} className="flex items-center space-x-3 p-3 rounded-lg bg-accent/50">
                              <DeviceIcon className="w-5 h-5 text-primary" />
                              <div className="flex-1">
                                <p className="font-medium">{device.deviceName}</p>
                                <p className="text-sm text-muted-foreground">{device.serialNumber}</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge variant={getStatusColor(device.status)} className="text-xs">
                                  {device.status}
                                </Badge>
                                <Button size="sm" variant="outline" onClick={() => handleReturnDevice(device.id)} title="Mark returned"> 
                                  <RotateCw className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleOpenReassign(device)} title="Reassign">
                                  <UserPlus className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        <div className="pt-2">
                          <p className="text-sm text-muted-foreground">
                            Total devices: {employeeDevices.length}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                        <p>No devices assigned</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => setIsAddDeviceOpen(true)}
                        >
                          Assign Device
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {employeesPaging.showControls && (
            <ListPagination
              page={employeesPaging.page}
              totalPages={employeesPaging.totalPages}
              hasPrev={employeesPaging.hasPrev}
              hasNext={employeesPaging.hasNext}
              rangeLabel={employeesPaging.rangeLabel}
              onPrev={() => employeesPaging.setPage((p) => Math.max(1, p - 1))}
              onNext={() =>
                employeesPaging.setPage((p) =>
                  Math.min(employeesPaging.totalPages, p + 1)
                )
              }
            />
          )}
        </TabsContent>

        {/* Available Devices Tab */}
        <TabsContent value="available" className="space-y-6">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Monitor className="w-5 h-5 text-primary" />
                <span>Available Devices</span>
              </CardTitle>
              <CardDescription>
                Devices ready to be assigned to employees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availablePaging.pagedItems.map((device) => {
                  const DeviceIcon = getDeviceIcon(device.deviceType);
                  return (
                    <div 
                      key={device.id} 
                      className="flex flex-col md:flex-row md:items-center md:justify-between p-4 rounded-lg border hover:shadow-md transition-shadow"
                    >
                      {/* Left Section */}
                      <div className="flex items-start md:items-center space-x-4 mb-4 md:mb-0">
                        <div className="p-3 bg-secondary/50 rounded-lg">
                          <DeviceIcon className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg">{device.deviceName || device.raw?.name}</h4>
                          <p className="text-muted-foreground">
                            {device.model} • {device.serialNumber}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>
                                Purchased: {device.raw?.purchaseDate ? new Date(device.raw.purchaseDate).toLocaleDateString() : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Section */}
                      <div className="flex flex-wrap items-center space-x-3">
                        <Badge className={getConditionColor(device.condition)}>
                          {device.condition}
                        </Badge>
                        <Badge variant="secondary">
                          {device.status}
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => { setAssignForm(prev => ({ ...prev, deviceId: device.id })); setIsAddDeviceOpen(true); }}
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Assign
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {availablePaging.showControls && (
                <div className="pt-4">
                  <ListPagination
                    page={availablePaging.page}
                    totalPages={availablePaging.totalPages}
                    hasPrev={availablePaging.hasPrev}
                    hasNext={availablePaging.hasNext}
                    rangeLabel={availablePaging.rangeLabel}
                    onPrev={() =>
                      availablePaging.setPage((p) => Math.max(1, p - 1))
                    }
                    onNext={() =>
                      availablePaging.setPage((p) =>
                        Math.min(availablePaging.totalPages, p + 1)
                      )
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HRDeviceManagement;