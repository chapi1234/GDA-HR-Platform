import { useState, useEffect, useMemo } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Laptop,
  Tablet,
  Smartphone,
  Monitor,
  Camera,
  Bike,
  Plus,
  Search,
  Edit,
  Trash2,
  Check,
  X,
  UserPlus,
  Calendar,
  MapPin,
  AlertCircle,
  RotateCcw,
  Package,
  Users,
  Sparkles,
  LayoutGrid,
  List,
  Download,
  ChevronDown,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useClientPagination } from '../hooks/useClientPagination';
import ListPagination from '../components/ListPagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { exportTableExcel } from '../utils/exportExcel';
import {
  DEVICE_TYPES,
  DEVICE_CATEGORIES,
  getCategoryForType,
  getFormFieldsForType,
  getTableColumnsForCategory,
  formatDeviceSpecs,
  emptyCreateForm,
  buildCreatePayload,
  getDeviceTypeMeta,
} from '../utils/deviceTypes';

const API_BASE = import.meta.env.VITE_API_URL || '';

const HRDeviceManagement = () => {
  const { t } = useLanguage();
  const { canManageDeviceInventory, canAssignDevices } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [categoryFilter, setCategoryFilter] = useState('all'); // all | computing | camera | motorcycle
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [isEditDeviceOpen, setIsEditDeviceOpen] = useState(false);
  const [isCreateDeviceOpen, setIsCreateDeviceOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [devices, setDevices] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    deviceId: '',
    location: '',
    notes: '',
    returnDueDate: '',
  });
  const [createForm, setCreateForm] = useState(() => emptyCreateForm('laptop'));

  const normalizeDevice = (d) => {
    const id = d._id || d.id;
    const deviceName = d.deviceName || d.name || '';
    const deviceType = d.deviceType || d.type || '';
    const employeeId =
      d.employeeId ||
      (d.assignedTo && (d.assignedTo._id || d.assignedTo)) ||
      null;
    const employeeName =
      d.employeeName ||
      (d.assignedTo && d.assignedTo.name) ||
      (
        employeesList.find(
          (e) => String(e._id || e.id) === String(employeeId)
        ) || {}
      ).name ||
      '';
    return {
      id,
      deviceName,
      deviceType,
      brand: d.brand || '',
      model: d.model || '',
      serialNumber: d.serialNumber || d.serial || '',
      ram: d.ram || '',
      storage: d.storage || '',
      megapixels: d.megapixels || '',
      resolution: d.resolution || '',
      lens: d.lens || '',
      plateNumber: d.plateNumber || '',
      chassisNumber: d.chassisNumber || '',
      engineCc: d.engineCc || '',
      color: d.color || '',
      year: d.year || '',
      otherType: d.otherType || '',
      specs: d.specs || '',
      employeeId,
      employeeName,
      assignedDate:
        d.assignedDate || d.assignedAt || d.assignedOn || d.assigned || null,
      returnDueDate: d.returnDueDate || null,
      status: d.status || 'available',
      location: d.location || '',
      condition: d.condition || 'good',
      category: getCategoryForType(deviceType),
      raw: d,
    };
  };

  const normalizedDevices = useMemo(
    () => (devices || []).map(normalizeDevice),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devices, employeesList]
  );

  const q = searchTerm.trim().toLowerCase();

  const matchesSearch = (device) => {
    if (!q) return true;
    const hay = [
      device.deviceName,
      device.employeeName,
      device.serialNumber,
      device.model,
      device.brand,
      device.plateNumber,
      device.chassisNumber,
      device.megapixels,
      device.lens,
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  };

  const categoryDevices = useMemo(() => {
    return normalizedDevices.filter((d) => {
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
      return matchesSearch(d);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedDevices, categoryFilter, q]);

  const filteredAll = categoryDevices;

  const availableDevices = useMemo(
    () => categoryDevices.filter((d) => d.status === 'available'),
    [categoryDevices]
  );

  const assignedCount = normalizedDevices.filter(
    (d) => d.status === 'assigned'
  ).length;
  const availableCount = normalizedDevices.filter(
    (d) => d.status === 'available'
  ).length;
  const maintenanceCount = normalizedDevices.filter(
    (d) => d.status === 'maintenance'
  ).length;

  const employeesWithDevices = useMemo(() => {
    const list = (employeesList || []).filter((emp) => {
      const empId = emp._id || emp.id;
      const nameMatch =
        !q ||
        String(emp.name || '')
          .toLowerCase()
          .includes(q) ||
        String(emp.employeeId || '')
          .toLowerCase()
          .includes(q);
      if (!nameMatch) return false;
      return true;
    });
    // Prefer people who have devices, then alphabetical
    return [...list].sort((a, b) => {
      const aN = getEmployeeDevices(a._id || a.id).length;
      const bN = getEmployeeDevices(b._id || b.id).length;
      if (bN !== aN) return bN - aN;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeesList, normalizedDevices, q]);

  function getEmployeeDevices(employeeId) {
    return normalizedDevices.filter(
      (device) => String(device.employeeId || '') === String(employeeId)
    );
  }

  const assignmentsPaging = useClientPagination(filteredAll, 9, [
    searchTerm,
    categoryFilter,
    devices.length,
  ]);
  const availablePaging = useClientPagination(availableDevices, 9, [
    searchTerm,
    categoryFilter,
    devices.length,
  ]);
  const employeesPaging = useClientPagination(employeesWithDevices, 8, [
    searchTerm,
    employeesList.length,
    devices.length,
  ]);

  const getDeviceIcon = (type) => {
    switch (String(type || '').toLowerCase()) {
      case 'laptop':
        return Laptop;
      case 'tablet':
        return Tablet;
      case 'phone':
        return Smartphone;
      case 'monitor':
        return Monitor;
      case 'camera':
        return Camera;
      case 'motorcycle':
        return Bike;
      default:
        return Laptop;
    }
  };

  const statusMeta = (status) => {
    switch (status) {
      case 'assigned':
        return {
          label: 'Assigned',
          className:
            'bg-primary/15 text-primary border-primary/20 hover:bg-primary/15',
        };
      case 'pending_approval':
        return {
          label: 'Pending approval',
          className:
            'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
        };
      case 'available':
        return {
          label: 'Available',
          className:
            'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
        };
      case 'maintenance':
        return {
          label: 'Maintenance',
          className:
            'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
        };
      case 'lost':
        return {
          label: 'Lost',
          className:
            'bg-destructive/15 text-destructive border-destructive/20',
        };
      case 'retired':
        return {
          label: 'Retired',
          className: 'bg-muted text-muted-foreground border-border',
        };
      default:
        return {
          label: status || 'Unknown',
          className: 'bg-secondary text-secondary-foreground',
        };
    }
  };

  const conditionClass = (condition) => {
    switch (condition) {
      case 'excellent':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25';
      case 'good':
        return 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25';
      case 'fair':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25';
      case 'poor':
        return 'bg-destructive/15 text-destructive border-destructive/25';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const typeAccent = (type) => {
    switch (String(type || '').toLowerCase()) {
      case 'laptop':
        return 'from-sky-500/20 to-sky-500/5 text-sky-600 dark:text-sky-300';
      case 'tablet':
        return 'from-indigo-500/20 to-indigo-500/5 text-indigo-600 dark:text-indigo-300';
      case 'phone':
        return 'from-teal-500/20 to-teal-500/5 text-teal-600 dark:text-teal-300';
      case 'monitor':
        return 'from-orange-500/20 to-orange-500/5 text-orange-600 dark:text-orange-300';
      case 'camera':
        return 'from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-300';
      case 'motorcycle':
        return 'from-lime-500/20 to-lime-500/5 text-lime-700 dark:text-lime-300';
      default:
        return 'from-primary/20 to-primary/5 text-primary';
    }
  };

  const tableColumns = useMemo(
    () => getTableColumnsForCategory(categoryFilter),
    [categoryFilter]
  );

  const deviceIdentityLine = (device) => {
    const t = String(device.deviceType || '').toLowerCase();
    if (t === 'motorcycle') {
      return device.plateNumber
        ? `Plate ${device.plateNumber}`
        : device.chassisNumber
          ? `VIN ${device.chassisNumber}`
          : 'No plate';
    }
    if (t === 'camera') {
      return device.serialNumber
        ? `SN ${device.serialNumber}`
        : [device.brand, device.model].filter(Boolean).join(' ') || 'No serial';
    }
    return device.serialNumber ? `SN ${device.serialNumber}` : 'No serial';
  };

  const renderDeviceActions = (device, { availableOnly = false } = {}) => (
    <div className="flex space-x-1">
      {device.status === 'pending_approval' && canManageDeviceInventory && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="text-emerald-600 hover:text-emerald-600"
            title="Approve assignment"
            onClick={() => handleApproveAssignment(device.id)}
          >
            <Check className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            title="Reject assignment"
            onClick={() => handleRejectAssignment(device.id)}
          >
            <X className="w-4 h-4" />
          </Button>
        </>
      )}
      {canAssignDevices &&
        device.status !== 'pending_approval' &&
        (device.status === 'available' || availableOnly ? (
          <Button
            variant="ghost"
            size="sm"
            title="Assign"
            onClick={() => {
              setAssignForm((p) => ({
                ...p,
                deviceId: String(device.id),
              }));
              setIsAddDeviceOpen(true);
            }}
          >
            <UserPlus className="w-4 h-4" />
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              title="Return"
              onClick={() => handleReturnDevice(device.id)}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Reassign"
              onClick={() => handleOpenReassign(device)}
            >
              <UserPlus className="w-4 h-4" />
            </Button>
          </>
        ))}
      {canManageDeviceInventory && (
        <>
          <Button
            variant="ghost"
            size="sm"
            title="Edit"
            onClick={() => handleEditDevice(device)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            title="Delete"
            onClick={() => handleDeleteDeviceRemote(device.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </>
      )}
      {!canAssignDevices && !canManageDeviceInventory && (
        <span className="text-xs text-muted-foreground">View only</span>
      )}
    </div>
  );

  const renderTableCell = (colKey, device, { availableOnly = false } = {}) => {
    const DeviceIcon = getDeviceIcon(device.deviceType);
    const st = statusMeta(device.status);
    switch (colKey) {
      case 'device':
        return (
          <div className="flex items-center space-x-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${typeAccent(
                device.deviceType
              )}`}
            >
              <DeviceIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-primary truncate">
                {device.deviceName}
              </p>
              <p className="text-sm text-muted-foreground font-mono truncate">
                {deviceIdentityLine(device)}
              </p>
            </div>
          </div>
        );
      case 'type':
        return (
          <span className="capitalize">
            {getDeviceTypeMeta(device.deviceType).label}
          </span>
        );
      case 'specs':
        return (
          <span className="text-sm text-muted-foreground">
            {formatDeviceSpecs(device)}
          </span>
        );
      case 'brand':
        return device.brand || '—';
      case 'model':
        return (
          <span className="max-w-[160px] truncate inline-block">
            {[device.brand, device.model].filter(Boolean).join(' ') || '—'}
          </span>
        );
      case 'ram':
        return device.ram || '—';
      case 'storage':
        return device.storage || '—';
      case 'megapixels':
        return device.megapixels || '—';
      case 'resolution':
        return device.resolution || '—';
      case 'lens':
        return (
          <span className="max-w-[180px] truncate inline-block">
            {device.lens || '—'}
          </span>
        );
      case 'plateNumber':
        return (
          <span className="font-mono text-sm">
            {device.plateNumber || '—'}
          </span>
        );
      case 'engineCc':
        return device.engineCc || '—';
      case 'color':
        return device.color || '—';
      case 'year':
        return device.year || '—';
      case 'otherType':
        return <span className="capitalize">{device.otherType || '—'}</span>;
      case 'assigned':
        return device.employeeName ? (
          <div>
            <p className="font-medium text-primary">{device.employeeName}</p>
            {device.location ? (
              <p className="text-xs text-muted-foreground">{device.location}</p>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      case 'condition':
        return (
          <Badge
            variant="outline"
            className={`capitalize ${conditionClass(device.condition)}`}
          >
            {device.condition || '—'}
          </Badge>
        );
      case 'status':
        return (
          <Badge variant="outline" className={`capitalize ${st.className}`}>
            {st.label}
          </Badge>
        );
      case 'actions':
        return renderDeviceActions(device, { availableOnly });
      default:
        return device[colKey] || '—';
    }
  };

  const refreshDevices = () => {
    const token = localStorage.getItem('authToken');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    axios
      .get(`${API_BASE}/api/devices/me`, { headers })
      .then((res) => {
        const payload = res.data?.data || res.data;
        if (Array.isArray(payload)) setDevices(payload);
      })
      .catch((err) => console.error('Failed to refresh devices', err));
  };

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    setLoadingDevices(true);
    axios
      .get(`${API_BASE}/api/devices/me`, { headers })
      .then((res) => {
        const payload = res.data?.data || res.data;
        if (Array.isArray(payload)) setDevices(payload);
      })
      .catch((err) => console.error('Failed to load devices', err))
      .finally(() => setLoadingDevices(false));

    axios
      .get(`${API_BASE}/api/employees`, { headers })
      .then((res) => {
        const payload = res.data?.data || res.data;
        if (Array.isArray(payload)) setEmployeesList(payload);
      })
      .catch((err) => console.error('Failed to load employees', err));
  }, []);

  const handleEditDevice = (device) => {
    setEditForm({
      id: device.id,
      name: device.deviceName || '',
      type: device.deviceType || 'laptop',
      model: device.model || '',
      brand: device.brand || '',
      serialNumber: device.serialNumber || '',
      ram: device.ram || '',
      storage: device.storage || '',
      megapixels: device.megapixels || '',
      resolution: device.resolution || '',
      lens: device.lens || '',
      plateNumber: device.plateNumber || '',
      chassisNumber: device.chassisNumber || '',
      engineCc: device.engineCc || '',
      color: device.color || '',
      year: device.year || '',
      otherType: device.otherType || '',
      specs: device.specs || '',
      location: device.location || '',
      status: device.status || 'available',
      condition: device.condition || 'good',
      notes: device.raw?.notes || '',
    });
    setIsEditDeviceOpen(true);
  };

  const handleOpenReassign = (device) => {
    setAssignForm({
      employeeId: '',
      deviceId: String(device.id),
      location: device.location || '',
      notes: '',
      returnDueDate: device.returnDueDate
        ? String(device.returnDueDate).slice(0, 10)
        : '',
    });
    setIsAddDeviceOpen(true);
  };

  const handleUpdateDevice = async () => {
    if (!editForm?.id) return;
    const token = localStorage.getItem('authToken');
    try {
      const payload = {
        ...buildCreatePayload(editForm),
        status: editForm.status,
        location: editForm.location,
        notes: editForm.notes,
      };
      const res = await axios.put(
        `${API_BASE}/api/devices/${editForm.id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = res.data?.data || res.data;
      setDevices((prev) =>
        prev.map((d) =>
          String(d._id || d.id) === String(data._id || data.id) ? data : d
        )
      );
      setIsEditDeviceOpen(false);
      setEditForm(null);
      toast.success('Device updated');
    } catch (err) {
      console.error('Failed to update device', err);
      toast.error(err.response?.data?.message || 'Failed to update device');
    }
  };

  const handleAssignSubmit = async () => {
    if (!assignForm.deviceId || !assignForm.employeeId) {
      toast.error('Select an employee and a device');
      return;
    }
    const token = localStorage.getItem('authToken');
    try {
      const res = await axios.post(
        `${API_BASE}/api/devices/${assignForm.deviceId}/assign`,
        {
          employeeId: assignForm.employeeId,
          location: assignForm.location,
          notes: assignForm.notes,
          returnDueDate: assignForm.returnDueDate || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsAddDeviceOpen(false);
      setAssignForm({
        employeeId: '',
        deviceId: '',
        location: '',
        notes: '',
        returnDueDate: '',
      });
      refreshDevices();
      toast.success(res.data?.message || 'Device assigned');
    } catch (err) {
      console.error('Failed to assign device', err);
      toast.error(err.response?.data?.message || 'Failed to assign device');
    }
  };

  const handleApproveAssignment = async (deviceId) => {
    const token = localStorage.getItem('authToken');
    try {
      await axios.post(
        `${API_BASE}/api/devices/${deviceId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      refreshDevices();
      toast.success('Assignment approved');
    } catch (err) {
      console.error('Failed to approve assignment', err);
      toast.error(err.response?.data?.message || 'Failed to approve assignment');
    }
  };

  const handleRejectAssignment = async (deviceId) => {
    const token = localStorage.getItem('authToken');
    try {
      await axios.post(
        `${API_BASE}/api/devices/${deviceId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      refreshDevices();
      toast.success('Assignment rejected — device is available again');
    } catch (err) {
      console.error('Failed to reject assignment', err);
      toast.error(err.response?.data?.message || 'Failed to reject assignment');
    }
  };

  const handleReturnDevice = async (deviceId) => {
    const token = localStorage.getItem('authToken');
    try {
      await axios.post(
        `${API_BASE}/api/devices/${deviceId}/return`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      refreshDevices();
      toast.success('Device returned to inventory');
    } catch (err) {
      console.error('Failed to return device', err);
      toast.error(err.response?.data?.message || 'Failed to return device');
    }
  };

  const handleCreateDevice = async () => {
    if (!createForm.name || !createForm.type) {
      toast.error('Name and type are required');
      return;
    }
    const token = localStorage.getItem('authToken');
    try {
      await axios.post(`${API_BASE}/api/devices`, buildCreatePayload(createForm), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsCreateDeviceOpen(false);
      setCreateForm(emptyCreateForm(createForm.type));
      refreshDevices();
      toast.success('Device added to inventory');
    } catch (err) {
      console.error('Failed to create device', err);
      toast.error(err.response?.data?.message || 'Failed to create device');
    }
  };

  const handleDeleteDeviceRemote = async (deviceId) => {
    if (!window.confirm('Delete this device from inventory?')) return;
    const token = localStorage.getItem('authToken');
    try {
      await axios.delete(`${API_BASE}/api/devices/${deviceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDevices((prev) =>
        prev.filter((d) => String(d._id || d.id) !== String(deviceId))
      );
      toast.success('Device deleted');
    } catch (err) {
      console.error('Failed to delete device', err);
      toast.error(err.response?.data?.message || 'Failed to delete device');
    }
  };

  /**
   * @param {'all' | 'assigned' | 'available'} mode
   */
  const handleExportDevices = (mode) => {
    const labels = {
      all: 'All devices',
      assigned: 'Assigned devices',
      available: 'Available devices',
    };
    const list =
      mode === 'available'
        ? normalizedDevices.filter((d) => d.status === 'available')
        : mode === 'assigned'
          ? normalizedDevices.filter(
              (d) =>
                d.status === 'assigned' || d.status === 'pending_approval'
            )
          : normalizedDevices;

    if (list.length === 0) {
      toast.info(`No ${labels[mode].toLowerCase()} to export`);
      return;
    }

    const fmtDate = (v) => {
      if (!v) return '';
      try {
        return new Date(v).toLocaleDateString();
      } catch {
        return '';
      }
    };

    const headers = [
      '#',
      'Name',
      'Type',
      'Brand',
      'Model',
      'Serial / Plate',
      'Specs',
      'Assigned to',
      'Location',
      'Assigned date',
      'Return due',
      'Condition',
      'Status',
    ];

    const rows = list.map((d, i) => {
      const t = String(d.deviceType || '').toLowerCase();
      const identity =
        t === 'motorcycle'
          ? d.plateNumber || d.chassisNumber || d.serialNumber || ''
          : d.serialNumber || d.plateNumber || '';
      return [
        i + 1,
        d.deviceName || '',
        getDeviceTypeMeta(d.deviceType).label,
        d.brand || '',
        d.model || '',
        identity,
        formatDeviceSpecs(d) === '—' ? '' : formatDeviceSpecs(d),
        d.employeeName || '',
        d.location || '',
        fmtDate(d.assignedDate),
        fmtDate(d.returnDueDate),
        d.condition || '',
        d.status === 'pending_approval'
          ? 'Pending approval'
          : d.status || '',
      ];
    });

    const day = new Date().toISOString().slice(0, 10);
    const fileSlug =
      mode === 'all'
        ? 'All'
        : mode === 'assigned'
          ? 'Assigned'
          : 'Available';

    exportTableExcel({
      title: 'Gamo Development Association — Device Inventory',
      subtitle: `${labels[mode]} · Exported ${new Date().toLocaleDateString()} · ${list.length} device(s)`,
      headers,
      rows,
      sheetName: fileSlug.slice(0, 31),
      filename: `GaDA-Devices-${fileSlug}-${day}.xlsx`,
      colWidths: [5, 22, 14, 12, 16, 18, 28, 18, 14, 12, 12, 12, 14],
    });
    toast.success(`Exported ${list.length} ${labels[mode].toLowerCase()} to Excel`);
  };

  const DeviceCard = ({ device, variant = 'all' }) => {
    const DeviceIcon = getDeviceIcon(device.deviceType);
    const st = statusMeta(device.status);
    const isAvailable = device.status === 'available';

    return (
      <article
        className="group relative flex flex-col rounded-2xl border bg-card/80 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/25"
      >
        <div
          className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${
            isAvailable
              ? 'from-emerald-500/80 to-teal-400/40'
              : 'from-primary/80 to-primary/20'
          }`}
        />
        <div className="flex flex-1 flex-col p-5 gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${typeAccent(
                device.deviceType
              )}`}
            >
              <DeviceIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground truncate leading-tight">
                    {device.deviceName || 'Untitled device'}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {[device.brand, device.model].filter(Boolean).join(' · ') ||
                      device.deviceType}
                  </p>
                </div>
                <Badge variant="outline" className={`shrink-0 capitalize ${st.className}`}>
                  {st.label}
                </Badge>
              </div>
              {device.serialNumber || device.plateNumber ? (
                <p className="mt-2 font-mono text-xs text-muted-foreground/90 tracking-wide">
                  {deviceIdentityLine(device)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {formatDeviceSpecs(device)
              .split(' · ')
              .filter((s) => s && s !== '—')
              .slice(0, 3)
              .map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {chip}
                </span>
              ))}
            <Badge
              variant="outline"
              className={`capitalize text-xs ${conditionClass(device.condition)}`}
            >
              {device.condition || '—'}
            </Badge>
          </div>

          {variant !== 'available' && device.employeeName ? (
            <div className="rounded-xl border bg-muted/40 px-3 py-2.5 space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium truncate">{device.employeeName}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {device.assignedDate ? (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(device.assignedDate).toLocaleDateString()}
                  </span>
                ) : null}
                {device.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {device.location}
                  </span>
                ) : null}
                {device.returnDueDate ? (
                  <span
                    className={`inline-flex items-center gap-1 ${
                      new Date(device.returnDueDate) < new Date()
                        ? 'text-destructive font-medium'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Due {new Date(device.returnDueDate).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {variant === 'available' && device.raw?.purchaseDate ? (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Purchased{' '}
              {new Date(device.raw.purchaseDate).toLocaleDateString()}
            </p>
          ) : null}

          {(canAssignDevices || canManageDeviceInventory) && (
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
              {device.status === 'pending_approval' &&
                (canManageDeviceInventory ? (
                  <>
                    <Button
                      size="sm"
                      className="flex-1 min-w-[6.5rem] bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleApproveAssignment(device.id)}
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRejectAssignment(device.id)}
                    >
                      <X className="w-4 h-4 mr-1.5" />
                      Reject
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground py-1.5">
                    Awaiting HR approval
                  </span>
                ))}
              {canAssignDevices &&
                device.status !== 'pending_approval' &&
                (isAvailable ? (
                  <Button
                    size="sm"
                    className="btn-gradient flex-1 min-w-[7rem]"
                    onClick={() => {
                      setAssignForm((prev) => ({
                        ...prev,
                        deviceId: String(device.id),
                      }));
                      setIsAddDeviceOpen(true);
                    }}
                  >
                    <UserPlus className="w-4 h-4 mr-1.5" />
                    Assign
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 min-w-[6.5rem]"
                      onClick={() => handleReturnDevice(device.id)}
                    >
                      <RotateCcw className="w-4 h-4 mr-1.5" />
                      Return
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleOpenReassign(device)}
                      title="Reassign"
                    >
                      <UserPlus className="w-4 h-4" />
                    </Button>
                  </>
                ))}
              {canManageDeviceInventory && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditDevice(device)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteDeviceRemote(device.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </article>
    );
  };

  const EmptyState = ({ title, hint, action }) => (
    <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 py-16 px-6 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Package className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>
      {action}
    </div>
  );

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Inventory & assignments
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {t('pages.devices')}
            </h1>
            <p className="text-muted-foreground">{t('pages.devicesDesc')}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 w-full lg:w-auto lg:min-w-[22rem]">
            {[
              { label: t('devices.assignedDevices'), value: assignedCount, tone: 'text-primary' },
              {
                label: t('devices.availableDevices'),
                value: availableCount,
                tone: 'text-emerald-600 dark:text-emerald-400',
              },
              {
                label: t('devices.maintenance'),
                value: maintenanceCount,
                tone: 'text-amber-600 dark:text-amber-400',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border bg-background/80 backdrop-blur px-3 py-3 text-center shadow-sm"
              >
                <div className={`text-2xl font-bold tabular-nums ${s.tone}`}>
                  {s.value}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('devices.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-background"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px] h-11 rounded-xl">
              <SelectValue placeholder="Device category" />
            </SelectTrigger>
            <SelectContent>
              {DEVICE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-xl border p-1 bg-muted/40">
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              className="rounded-lg gap-1.5"
              onClick={() => setViewMode('table')}
            >
              <List className="w-4 h-4" />
              Table
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              className="rounded-lg gap-1.5"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-4 h-4" />
              Grid
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-xl h-11">
                <Download className="w-4 h-4 mr-2" />
                {t('devices.exportExcel')}
                <ChevronDown className="w-4 h-4 ml-2 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => handleExportDevices('all')}>
                {t('devices.allDevices')}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {normalizedDevices.length}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExportDevices('assigned')}
              >
                {t('devices.assignedDevices')}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {
                    normalizedDevices.filter(
                      (d) =>
                        d.status === 'assigned' ||
                        d.status === 'pending_approval'
                    ).length
                  }
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExportDevices('available')}
              >
                {t('devices.availableDevices')}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {availableCount}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={isCreateDeviceOpen} onOpenChange={setIsCreateDeviceOpen}>
            {canManageDeviceInventory && (
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-xl h-11">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('devices.addDevice')}
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('devices.addDevice')}</DialogTitle>
                <DialogDescription>
                  Create a new asset ready for assignment.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="space-y-2">
                  <Label>Device type</Label>
                  <Select
                    value={createForm.type}
                    onValueChange={(v) =>
                      setCreateForm((prev) => ({
                        ...emptyCreateForm(v),
                        name: prev.name,
                        condition: prev.condition,
                        notes: prev.notes,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEVICE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Fields below change for{' '}
                    {getDeviceTypeMeta(createForm.type).label}.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Display name</Label>
                  <Input
                    placeholder={
                      createForm.type === 'motorcycle'
                        ? 'e.g., Fleet bike #3'
                        : createForm.type === 'camera'
                          ? 'e.g., Studio camera A'
                          : 'e.g., MacBook Pro 16'
                    }
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Select
                    value={createForm.condition}
                    onValueChange={(v) =>
                      setCreateForm((p) => ({ ...p, condition: v }))
                    }
                  >
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {getFormFieldsForType(createForm.type).map((field) => (
                    <div
                      key={field.key}
                      className={`space-y-2 ${
                        field.key === 'lens' || field.key === 'chassisNumber'
                          ? 'sm:col-span-2'
                          : ''
                      }`}
                    >
                      <Label>{field.label}</Label>
                      <Input
                        placeholder={field.placeholder}
                        value={createForm[field.key] || ''}
                        onChange={(e) =>
                          setCreateForm((p) => ({
                            ...p,
                            [field.key]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDeviceOpen(false)}
                >
                  Cancel
                </Button>
                <Button className="btn-gradient" onClick={handleCreateDevice}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddDeviceOpen} onOpenChange={setIsAddDeviceOpen}>
            {canAssignDevices && (
              <DialogTrigger asChild>
                <Button className="btn-gradient rounded-xl h-11">
                  <UserPlus className="w-4 h-4 mr-2" />
                  {t('devices.assignDevice')}
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[440px]">
              <DialogHeader>
                <DialogTitle>{t('devices.assignDevice')}</DialogTitle>
                <DialogDescription>
                  Link an available device to an employee.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select
                    value={assignForm.employeeId}
                    onValueChange={(v) =>
                      setAssignForm((p) => ({ ...p, employeeId: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeesList.map((employee) => {
                        const empId = employee._id || employee.id;
                        return (
                          <SelectItem key={empId} value={String(empId)}>
                            {employee.name}
                            {employee.unitPath || employee.department
                              ? ` — ${employee.unitPath || employee.department}`
                              : ''}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Device</Label>
                  <Select
                    value={assignForm.deviceId}
                    onValueChange={(v) =>
                      setAssignForm((p) => ({ ...p, deviceId: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select device" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Include current device if reassigning (may not be available) */}
                      {normalizedDevices
                        .filter(
                          (d) =>
                            d.status === 'available' ||
                            String(d.id) === String(assignForm.deviceId)
                        )
                        .map((device) => (
                          <SelectItem key={device.id} value={String(device.id)}>
                            {device.deviceName}
                            {device.serialNumber
                              ? ` — ${device.serialNumber}`
                              : ''}
                            {device.status !== 'available'
                              ? ' (currently assigned)'
                              : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    placeholder="Desk / office"
                    value={assignForm.location}
                    onChange={(e) =>
                      setAssignForm((p) => ({
                        ...p,
                        location: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Return due date</Label>
                  <Input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={assignForm.returnDueDate}
                    onChange={(e) =>
                      setAssignForm((p) => ({
                        ...p,
                        returnDueDate: e.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional — the employee gets a notification and email when
                    this date arrives.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Optional notes"
                    value={assignForm.notes}
                    onChange={(e) =>
                      setAssignForm((p) => ({ ...p, notes: e.target.value }))
                    }
                  />
                </div>
                {!canManageDeviceInventory && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Your assignment will stay pending until HR or an admin
                    approves it.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDeviceOpen(false)}
                >
                  Cancel
                </Button>
                <Button className="btn-gradient" onClick={handleAssignSubmit}>
                  {canManageDeviceInventory ? 'Assign' : 'Request assignment'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog
        open={isEditDeviceOpen}
        onOpenChange={(open) => {
          setIsEditDeviceOpen(open);
          if (!open) setEditForm(null);
        }}
      >
        <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit device</DialogTitle>
            <DialogDescription>Update inventory details.</DialogDescription>
          </DialogHeader>
          {editForm && (
            <div className="grid gap-3 py-2">
              <div className="space-y-2">
                <Label>Device type</Label>
                <Select
                  value={editForm.type}
                  onValueChange={(v) =>
                    setEditForm((p) => ({ ...p, type: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Display name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(v) =>
                      setEditForm((p) => ({ ...p, status: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="pending_approval">
                        Pending approval
                      </SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Select
                    value={editForm.condition}
                    onValueChange={(v) =>
                      setEditForm((p) => ({ ...p, condition: v }))
                    }
                  >
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {getFormFieldsForType(editForm.type).map((field) => (
                  <div
                    key={field.key}
                    className={`space-y-2 ${
                      field.key === 'lens' || field.key === 'chassisNumber'
                        ? 'sm:col-span-2'
                        : ''
                    }`}
                  >
                    <Label>{field.label}</Label>
                    <Input
                      placeholder={field.placeholder}
                      value={editForm[field.key] || ''}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          [field.key]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={editForm.location}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, location: e.target.value }))
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDeviceOpen(false)}
            >
              Cancel
            </Button>
            <Button className="btn-gradient" onClick={handleUpdateDevice}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs defaultValue="all-devices" className="space-y-6">
        <TabsList className="h-auto w-full flex flex-wrap justify-start gap-1 p-1.5 rounded-2xl bg-muted/60">
          <TabsTrigger
            value="all-devices"
            className="rounded-xl px-4 py-2.5 data-[state=active]:shadow-sm gap-2"
          >
            <Laptop className="h-4 w-4" />
            All devices
            <span className="ml-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {filteredAll.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="by-employee"
            className="rounded-xl px-4 py-2.5 data-[state=active]:shadow-sm gap-2"
          >
            <Users className="h-4 w-4" />
            By employee
          </TabsTrigger>
          <TabsTrigger
            value="available"
            className="rounded-xl px-4 py-2.5 data-[state=active]:shadow-sm gap-2"
          >
            <Package className="h-4 w-4" />
            Available
            <span className="ml-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {availableDevices.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all-devices" className="space-y-4 mt-0">
          {loadingDevices ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Loading inventory…
            </p>
          ) : filteredAll.length === 0 ? (
            <EmptyState
              title="No devices found"
              hint="Try another search, or add a device to the inventory."
              action={
                canManageDeviceInventory ? (
                  <Button
                    className="mt-4 btn-gradient"
                    onClick={() => setIsCreateDeviceOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('devices.addDevice')}
                  </Button>
                ) : null
              }
            />
          ) : viewMode === 'grid' ? (
            <>
              <p className="text-sm text-muted-foreground">
                {assignmentsPaging.rangeLabel}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {assignmentsPaging.pagedItems.map((device) => (
                  <DeviceCard key={device.id} device={device} variant="all" />
                ))}
              </div>
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
            </>
          ) : (
            <Card className="data-table">
              <div className="px-4 pt-4 text-sm text-muted-foreground">
                {assignmentsPaging.rangeLabel}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {tableColumns.map((col) => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignmentsPaging.pagedItems.map((device) => (
                    <TableRow key={device.id}>
                      {tableColumns.map((col) => (
                        <TableCell key={col.key}>
                          {renderTableCell(col.key, device)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {assignmentsPaging.showControls && (
                <div className="p-4 pt-2">
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
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="by-employee" className="space-y-4 mt-0">
          {employeesPaging.pagedItems.length === 0 ? (
            <EmptyState
              title="No employees match"
              hint="Adjust your search to find people in your scope."
            />
          ) : viewMode === 'grid' ? (
            <>
              <p className="text-sm text-muted-foreground">
                {employeesPaging.rangeLabel}
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {employeesPaging.pagedItems.map((employee) => {
                  const empId = employee._id || employee.id;
                  const employeeDevices = getEmployeeDevices(empId);
                  return (
                    <Card
                      key={empId}
                      className="overflow-hidden border rounded-2xl transition-all duration-300 hover:shadow-lg hover:border-primary/20"
                    >
                      <CardHeader className="pb-3 bg-gradient-to-br from-muted/50 to-transparent">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12 ring-2 ring-background shadow-sm">
                            <AvatarImage
                              src={
                                employee.profileImage ||
                                employee.avatar ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  employee.name || 'U'
                                )}&background=0D8ABC&color=fff`
                              }
                            />
                            <AvatarFallback>
                              {(employee.name || 'U')
                                .split(' ')
                                .map((n) => n[0])
                                .join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-base truncate">
                              {employee.name}
                            </CardTitle>
                            <CardDescription className="truncate">
                              {employee.unitPath ||
                                employee.department ||
                                employee.position ||
                                'Staff'}
                            </CardDescription>
                          </div>
                          <Badge
                            variant="secondary"
                            className="shrink-0 tabular-nums"
                          >
                            {employeeDevices.length} device
                            {employeeDevices.length === 1 ? '' : 's'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-2">
                        {employeeDevices.length > 0 ? (
                          employeeDevices.map((device) => {
                            const DeviceIcon = getDeviceIcon(device.deviceType);
                            const st = statusMeta(device.status);
                            return (
                              <div
                                key={device.id}
                                className="flex items-center gap-3 rounded-xl border bg-card/60 p-3 transition-colors hover:bg-accent/40"
                              >
                                <div
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${typeAccent(
                                    device.deviceType
                                  )}`}
                                >
                                  <DeviceIcon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-sm truncate">
                                    {device.deviceName}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {deviceIdentityLine(device)}
                                  </p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${st.className}`}
                                >
                                  {st.label}
                                </Badge>
                                {canAssignDevices && (
                                  <div className="flex gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      title="Return"
                                      onClick={() =>
                                        handleReturnDevice(device.id)
                                      }
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      title="Reassign"
                                      onClick={() => handleOpenReassign(device)}
                                    >
                                      <UserPlus className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
                            <AlertCircle className="h-8 w-8 mb-2 opacity-60" />
                            <p className="text-sm">No devices assigned</p>
                            {canAssignDevices && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-3 rounded-lg"
                                onClick={() => {
                                  setAssignForm((p) => ({
                                    ...p,
                                    employeeId: String(empId),
                                  }));
                                  setIsAddDeviceOpen(true);
                                }}
                              >
                                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                                {t('devices.assignDevice')}
                              </Button>
                            )}
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
                  onPrev={() =>
                    employeesPaging.setPage((p) => Math.max(1, p - 1))
                  }
                  onNext={() =>
                    employeesPaging.setPage((p) =>
                      Math.min(employeesPaging.totalPages, p + 1)
                    )
                  }
                />
              )}
            </>
          ) : (
            <Card className="data-table">
              <div className="px-4 pt-4 text-sm text-muted-foreground">
                {employeesPaging.rangeLabel}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Unit / Sector</TableHead>
                    <TableHead>Devices</TableHead>
                    <TableHead>Assigned gear</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeesPaging.pagedItems.map((employee) => {
                    const empId = employee._id || employee.id;
                    const employeeDevices = getEmployeeDevices(empId);
                    return (
                      <TableRow key={empId}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage
                                src={
                                  employee.profileImage ||
                                  employee.avatar ||
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    employee.name || 'U'
                                  )}&background=0D8ABC&color=fff`
                                }
                              />
                              <AvatarFallback>
                                {(employee.name || 'U')
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-primary">
                                {employee.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {employee.email || employee.employeeId || ''}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell
                          className="max-w-[220px] truncate"
                          title={
                            employee.unitPath || employee.department || ''
                          }
                        >
                          {employee.unitPath || employee.department || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="tabular-nums">
                            {employeeDevices.length}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          {employeeDevices.length === 0 ? (
                            <span className="text-muted-foreground text-sm">
                              None
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {employeeDevices.slice(0, 3).map((d) => (
                                <Badge
                                  key={d.id}
                                  variant="outline"
                                  className="text-xs font-normal truncate max-w-[120px]"
                                >
                                  {d.deviceName}
                                </Badge>
                              ))}
                              {employeeDevices.length > 3 ? (
                                <Badge variant="secondary" className="text-xs">
                                  +{employeeDevices.length - 3}
                                </Badge>
                              ) : null}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {canAssignDevices ? (
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                title={t('devices.assignDevice')}
                                onClick={() => {
                                  setAssignForm((p) => ({
                                    ...p,
                                    employeeId: String(empId),
                                  }));
                                  setIsAddDeviceOpen(true);
                                }}
                              >
                                <UserPlus className="w-4 h-4" />
                              </Button>
                              {employeeDevices[0] ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Return first device"
                                  onClick={() =>
                                    handleReturnDevice(employeeDevices[0].id)
                                  }
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              View only
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {employeesPaging.showControls && (
                <div className="p-4 pt-2">
                  <ListPagination
                    page={employeesPaging.page}
                    totalPages={employeesPaging.totalPages}
                    hasPrev={employeesPaging.hasPrev}
                    hasNext={employeesPaging.hasNext}
                    rangeLabel={employeesPaging.rangeLabel}
                    onPrev={() =>
                      employeesPaging.setPage((p) => Math.max(1, p - 1))
                    }
                    onNext={() =>
                      employeesPaging.setPage((p) =>
                        Math.min(employeesPaging.totalPages, p + 1)
                      )
                    }
                  />
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-4 mt-0">
          {availableDevices.length === 0 ? (
            <EmptyState
              title="No available devices"
              hint="Everything is assigned, or nothing matches your search."
              action={
                canManageDeviceInventory ? (
                  <Button
                    className="mt-4 btn-gradient"
                    onClick={() => setIsCreateDeviceOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add to inventory
                  </Button>
                ) : null
              }
            />
          ) : viewMode === 'grid' ? (
            <>
              <p className="text-sm text-muted-foreground">
                {availablePaging.rangeLabel}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {availablePaging.pagedItems.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    variant="available"
                  />
                ))}
              </div>
              {availablePaging.showControls && (
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
              )}
            </>
          ) : (
            <Card className="data-table">
              <div className="px-4 pt-4 text-sm text-muted-foreground">
                {availablePaging.rangeLabel}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {tableColumns
                      .filter((col) => col.key !== 'assigned')
                      .map((col) => (
                        <TableHead key={col.key}>{col.label}</TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availablePaging.pagedItems.map((device) => (
                    <TableRow key={device.id}>
                      {tableColumns
                        .filter((col) => col.key !== 'assigned')
                        .map((col) => (
                          <TableCell key={col.key}>
                            {renderTableCell(col.key, device, {
                              availableOnly: true,
                            })}
                          </TableCell>
                        ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {availablePaging.showControls && (
                <div className="p-4 pt-2">
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
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HRDeviceManagement;
