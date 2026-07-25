import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';
import {
  Laptop, Tablet, Smartphone, Monitor, Keyboard, Mouse, Camera, Bike,
  Calendar, MapPin, User, Clock
} from 'lucide-react';
import { useClientPagination } from '../hooks/useClientPagination';
import ListPagination from '../components/ListPagination';

const EmployeeDevices = () => {

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
  const { user } = useAuth();

  // Live device state for current employee (will replace dummy data)
  const [myDevices, setMyDevices] = useState([]);
  const [loading, setLoading] = useState(false);

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
      case 'accessory':
        return Keyboard;
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
      case 'returned':
        return 'secondary';
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

  // Normalizer: convert server device shape into the UI shape used here
  const normalizeDevice = (d) => {
    const id = d._id || d.id || d.deviceId || null;
    const name = d.name || d.deviceName || d.raw?.name || '';
    const type = d.type || d.deviceType || '';
    const model = d.model || '';
    const serialNumber = d.serialNumber || d.serial || '';
    const assignedDate = d.assignedDate || d.assignedAt || d.assignedOn || d.assigned || null;
    const returnDueDate = d.returnDueDate || null;
    const status = d.status || 'active';
    const location = d.location || '';
    const condition = d.condition || 'good';
    return { id, name, type, model, serialNumber, assignedDate, returnDueDate, status, location, condition, raw: d };
  };

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    setLoading(true);
    axios.get(`${API_BASE}/api/devices/me`, { headers })
      .then(res => {
        const payload = res.data?.data || res.data;
        if (Array.isArray(payload)) {
          setMyDevices(payload.map(normalizeDevice));
        } else if (payload && Array.isArray(payload.devices)) {
          setMyDevices(payload.devices.map(normalizeDevice));
        } else {
          setMyDevices([]);
        }
      })
      .catch(err => {
        console.error('Failed to load employee devices', err);
        // keep an empty array as fallback
        setMyDevices([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const devicesPaging = useClientPagination(myDevices, 10, [myDevices.length]);

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="bg-gradient-hero rounded-2xl p-8 text-black dark:text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Company Devices</h1>
            <p className="text-primary-foreground/90">Devices assigned to you by the company</p>
          </div>
          <div className="hidden md:block">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-2xl font-bold">{myDevices.length}</div>
              <div className="text-sm text-primary-foreground/80">Total Devices</div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={wrapperStyle} className="flex flex-wrap gap-4 mb-5">
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Laptop className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{myDevices.filter(d => d.type === 'laptop').length}</p>
                  <p className="text-sm text-muted-foreground">Laptops</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Tablet className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{myDevices.filter(d => d.type === 'tablet').length}</p>
                  <p className="text-sm text-muted-foreground">Tablets</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Smartphone className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{myDevices.filter(d => d.type === 'phone').length}</p>
                  <p className="text-sm text-muted-foreground">Phones</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div style={statCardsContainerStyle} className="flex-1 min-w-[200px] sm:min-w-[220px] md:min-w-[240px]">
          <Card className="dashboard-card">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Monitor className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{myDevices.filter(d => ['monitor', 'accessory'].includes(d.type)).length}</p>
                  <p className="text-sm text-muted-foreground">Accessories</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Devices List */}
      <Card style={marginStyle} className="dashboard-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Laptop className="w-5 h-5 text-primary" />
            <span>My Assigned Devices</span>
          </CardTitle>
          <CardDescription>
            All devices currently assigned to {user?.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {devicesPaging.pagedItems.map((device) => {
              const DeviceIcon = getDeviceIcon(device.type);
              return (
                <div 
                  key={device.id} 
                  className="flex items-center justify-between p-4 rounded-lg border hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-accent rounded-lg">
                      <DeviceIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">{device.name}</h4>
                      <p className="text-muted-foreground">{device.model}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>Assigned: {new Date(device.assignedDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span>{device.location}</span>
                        </div>
                        {device.returnDueDate && (
                          <div
                            className={`flex items-center space-x-1 font-medium ${
                              new Date(device.returnDueDate) < new Date()
                                ? 'text-destructive'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            <Clock className="w-4 h-4" />
                            <span>
                              Return by:{' '}
                              {new Date(device.returnDueDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
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
                  </div>
                </div>
              );
            })}
            {devicesPaging.showControls && (
              <ListPagination
                page={devicesPaging.page}
                totalPages={devicesPaging.totalPages}
                hasPrev={devicesPaging.hasPrev}
                hasNext={devicesPaging.hasNext}
                rangeLabel={devicesPaging.rangeLabel}
                onPrev={() => devicesPaging.setPage((p) => Math.max(1, p - 1))}
                onNext={() =>
                  devicesPaging.setPage((p) =>
                    Math.min(devicesPaging.totalPages, p + 1)
                  )
                }
              />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 mb-5">
        {/* Device History */}
        <Card style={marginStyle} className="dashboard-card flex-1">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-primary" />
              <span>Device Assignment History</span>
            </CardTitle>
            <CardDescription>
              Timeline of your device assignments and returns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(() => {
                // build timeline events from myDevices
                if (loading) {
                  return (
                    <div className="text-sm text-muted-foreground">Loading history...</div>
                  );
                }

                const userId = user?._id || user?.id || user?.employeeId || user?.email;
                const events = [];

                myDevices.forEach(device => {
                  const devName = device.name || device.raw?.name || 'Device';
                  // prefer server-side history array if present
                  const hist = (device.raw && Array.isArray(device.raw.history)) ? device.raw.history : [];
                  if (hist.length) {
                    hist.forEach(h => {
                      // h may have employee as id or populated object
                      const hEmployeeId = (typeof h.employee === 'string') ? h.employee : (h.employee && (h.employee._id || h.employee.id || h.employee.email));
                      // match by id or email
                      const matched = userId && hEmployeeId && (String(hEmployeeId) === String(userId) || String(hEmployeeId) === String(user?.email) || String(userId) === String(user?.email));
                      if (matched) {
                        events.push({
                          device: devName,
                          action: h.action || h.type || 'updated',
                          date: h.date || h.at || h.createdAt || h.timestamp || null,
                          notes: h.notes || h.locationNotes || '',
                          location: h.location || ''
                        });
                      }
                    });
                  } else {
                    // fallback: include assignedDate for this device if assigned to current user
                    const assignedTo = device.raw && (device.raw.assignedTo || device.raw.employeeId || device.raw.employee) ;
                    const assignedId = (typeof assignedTo === 'string') ? assignedTo : (assignedTo && (assignedTo._id || assignedTo.id || assignedTo.email));
                    const isAssignedToUser = userId && assignedId && (String(assignedId) === String(userId) || String(assignedId) === String(user?.email));
                    if (isAssignedToUser && device.assignedDate) {
                      events.push({ device: devName, action: 'assigned', date: device.assignedDate, notes: '', location: device.location });
                    }
                  }
                });

                if (!events.length) {
                  return (<div className="text-sm text-muted-foreground">No device history available.</div>);
                }

                // sort by date descending
                events.sort((a,b) => {
                  const da = a.date ? new Date(a.date).getTime() : 0;
                  const db = b.date ? new Date(b.date).getTime() : 0;
                  return db - da;
                });

                return events.map((ev, idx) => (
                  <div key={`${ev.device}-${idx}`} className={`flex items-center space-x-4 p-3 rounded-lg ${idx === 0 ? 'bg-accent/50' : ''}`}>
                    <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-primary' : 'bg-muted-foreground'}`}></div>
                    <div className="flex-1">
                      <p className="font-medium">{ev.device} &mdash; {ev.action}</p>
                      <p className="text-sm text-muted-foreground">{ev.date ? new Date(ev.date).toLocaleDateString() : 'Unknown date'}{ev.location ? ` — ${ev.location}` : ''}{ev.notes ? ` • ${ev.notes}` : ''}</p>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="dashboard-card flex-1">
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
            <CardDescription>
              Contact IT support for device-related queries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm">
                <strong>IT Support:</strong> getachewhabtamu29@gmail.com
              </p>
              <p className="text-sm">
                <strong>Phone:</strong> +2519-2469-9554
              </p>
              <p className="text-sm">
                <strong>Office Hours:</strong> Monday - Friday, 9:00 AM - 6:00 PM
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmployeeDevices;