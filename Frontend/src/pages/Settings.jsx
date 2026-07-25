import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { 
  Settings as SettingsIcon, Bell, Palette, Globe, Shield, 
  Monitor, Sun, Moon, Smartphone, Save, Download, Upload, Check 
} from 'lucide-react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';

const Settings = () => {

  const wrapperStyle = {
    paddingBottom: "20px",
    marginTop: "20px"
  };

  const statCardsContainerStyle = {    
    alignItems: "stretch",
  };

  const marginStyle = {
    marginBottom: "40px"
  };

  const button = {
    width: "200px"
  };

  const { user } = useAuth();
  const { theme, setTheme, colorScheme, setColorScheme } = useTheme();
  const [settings, setSettings] = useState({
    // Notifications
    emailNotifications: true,
    pushNotifications: true,
    weeklyReports: true,
    leaveReminders: true,
    attendanceAlerts: false,
    
    // Privacy
    profileVisibility: 'team',
    showOnlineStatus: true,
    shareCalendar: false,
    
    // Language & Region
    language: 'en',
    timezone: 'UTC-5',
    dateFormat: 'MM/DD/YYYY',
    
    // Advanced
    twoFactorAuth: false,
    sessionTimeout: '8',
    autoLogout: true
  });

  const colorSchemes = [
    { value: 'blue', label: 'Blue', color: 'bg-blue-500' },
    { value: 'green', label: 'Green', color: 'bg-green-500' },
    { value: 'purple', label: 'Purple', color: 'bg-purple-500' },
    { value: 'orange', label: 'Orange', color: 'bg-orange-500' },
    { value: 'red', label: 'Red', color: 'bg-red-500' },
    { value: 'teal', label: 'Teal', color: 'bg-teal-500' }
  ];

  const handleSaveSettings = () => {
    // Simulate saving settings
    localStorage.setItem('userSettings', JSON.stringify(settings));
    toast.success('Settings saved successfully!');
  };

  const handleExportData = () => {
    const book = XLSX.utils.book_new();
    const exportedAt = new Date().toISOString();

    const profileRows = [
      ['Field', 'Value'],
      ['Name', user?.name || ''],
      ['Email', user?.email || ''],
      ['Phone', user?.phone || ''],
      ['Role', user?.role || ''],
      ['Unit / Sector', user?.unitPath || ''],
      ['Position', user?.position || ''],
      ['Bank', user?.bankName || 'Commercial Bank of Ethiopia'],
      ['Account name', user?.bankAccountName || ''],
      ['Account number', user?.bankAccountNumber || ''],
      ['Export date', exportedAt],
    ];
    const profileSheet = XLSX.utils.aoa_to_sheet(profileRows);
    profileSheet['!cols'] = [{ wch: 18 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(book, profileSheet, 'Profile');

    const settingsRows = [
      ['Setting', 'Value'],
      ...Object.entries(settings || {}).map(([key, value]) => [
        key,
        typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''),
      ]),
      ['exportDate', exportedAt],
    ];
    const settingsSheet = XLSX.utils.aoa_to_sheet(settingsRows);
    settingsSheet['!cols'] = [{ wch: 24 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(book, settingsSheet, 'Settings');

    const day = new Date().toISOString().split('T')[0];
    XLSX.writeFile(book, `GaDA-Settings-Export-${day}.xlsx`);
    toast.success('Data exported to Excel');
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">Customize your experience and preferences</p>
          </div>
          <Button style={button} onClick={handleSaveSettings} className="btn-gradient">
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>

        <Tabs defaultValue="appearance" className="w-full">
          <TabsList style={marginStyle} className="flex flex-wrap w-full gap-2 mb-6">
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="regional">Regional</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* Appearance Settings */}
          <TabsContent value="appearance" className="space-y-6">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Palette className="w-5 h-5 mr-2" />
                  Appearance & Theme
                </CardTitle>
                <CardDescription>Customize how GammoDA looks and feels</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">
                          <div className="flex items-center">
                            <Sun className="w-4 h-4 mr-2" />
                            Light
                          </div>
                        </SelectItem>
                        <SelectItem value="dark">
                          <div className="flex items-center">
                            <Moon className="w-4 h-4 mr-2" />
                            Dark
                          </div>
                        </SelectItem>
                        <SelectItem value="system">
                          <div className="flex items-center">
                            <Monitor className="w-4 h-4 mr-2" />
                            System
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Color Scheme</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {colorSchemes.map((scheme) => (
                        <div
                          key={scheme.value}
                          className={`flex items-center justify-between gap-2 p-3 sm:p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:bg-accent hover:scale-[1.02] ${
                            colorScheme === scheme.value ? 'ring-2 ring-primary bg-accent' : ''
                          }`}
                          onClick={() => setColorScheme(scheme.value)}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className={`w-5 h-5 shrink-0 rounded-full ${scheme.color} shadow-sm`} />
                            <span className="font-medium truncate">{scheme.label}</span>
                          </div>
                          {colorScheme === scheme.value && (
                            <>
                              <Check className="w-4 h-4 shrink-0 text-primary sm:hidden" aria-label="Selected" />
                              <Badge variant="default" className="hidden sm:inline-flex text-xs font-medium shrink-0">
                                Selected
                              </Badge>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Font Size</Label>
                    <Select value={settings.fontSize} onValueChange={(value) => setSettings({...settings, fontSize: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Compact Mode</Label>
                      <p className="text-sm text-muted-foreground">Use smaller spacing and components</p>
                    </div>
                    <Switch
                      checked={settings.compactMode}
                      onCheckedChange={(checked) => setSettings({...settings, compactMode: checked})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="w-5 h-5 mr-2" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>Choose how and when you want to be notified</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <div className="space-y-0.5">
                      <Label className="cursor-pointer">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                    </div>
                    <Switch
                      checked={settings.emailNotifications}
                      onCheckedChange={(checked) => setSettings({...settings, emailNotifications: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <div className="space-y-0.5">
                      <Label className="cursor-pointer">Push Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive browser push notifications</p>
                    </div>
                    <Switch
                      checked={settings.pushNotifications}
                      onCheckedChange={(checked) => setSettings({...settings, pushNotifications: checked})}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <div className="space-y-0.5">
                      <Label className="cursor-pointer">Weekly Reports</Label>
                      <p className="text-sm text-muted-foreground">Receive weekly attendance and performance reports</p>
                    </div>
                    <Switch
                      checked={settings.weeklyReports}
                      onCheckedChange={(checked) => setSettings({...settings, weeklyReports: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <div className="space-y-0.5">
                      <Label className="cursor-pointer">Leave Reminders</Label>
                      <p className="text-sm text-muted-foreground">Get reminded about pending leave requests</p>
                    </div>
                    <Switch
                      checked={settings.leaveReminders}
                      onCheckedChange={(checked) => setSettings({...settings, leaveReminders: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <div className="space-y-0.5">
                      <Label className="cursor-pointer">Attendance Alerts</Label>
                      <p className="text-sm text-muted-foreground">Notifications for attendance-related activities</p>
                    </div>
                    <Switch
                      checked={settings.attendanceAlerts}
                      onCheckedChange={(checked) => setSettings({...settings, attendanceAlerts: checked})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Settings */}
          <TabsContent value="privacy" className="space-y-6">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Privacy & Security
                </CardTitle>
                <CardDescription>Control who can see your information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Profile Visibility</Label>
                    <Select value={settings.profileVisibility} onValueChange={(value) => setSettings({...settings, profileVisibility: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Everyone</SelectItem>
                        <SelectItem value="team">Team Members Only</SelectItem>
                        <SelectItem value="department">Unit Only</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Show Online Status</Label>
                      <p className="text-sm text-muted-foreground">Let others see when you're online</p>
                    </div>
                    <Switch
                      checked={settings.showOnlineStatus}
                      onCheckedChange={(checked) => setSettings({...settings, showOnlineStatus: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Share Calendar</Label>
                      <p className="text-sm text-muted-foreground">Allow team members to view your calendar</p>
                    </div>
                    <Switch
                      checked={settings.shareCalendar}
                      onCheckedChange={(checked) => setSettings({...settings, shareCalendar: checked})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Regional Settings */}
          <TabsContent value="regional" className="space-y-6">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="w-5 h-5 mr-2" />
                  Language & Region
                </CardTitle>
                <CardDescription>Set your language, timezone, and regional preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select value={settings.language} onValueChange={(value) => setSettings({...settings, language: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select value={settings.timezone} onValueChange={(value) => setSettings({...settings, timezone: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC-8">Pacific Time (UTC-8)</SelectItem>
                        <SelectItem value="UTC-7">Mountain Time (UTC-7)</SelectItem>
                        <SelectItem value="UTC-6">Central Time (UTC-6)</SelectItem>
                        <SelectItem value="UTC-5">Eastern Time (UTC-5)</SelectItem>
                        <SelectItem value="UTC+0">GMT (UTC+0)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date Format</Label>
                    <Select value={settings.dateFormat} onValueChange={(value) => setSettings({...settings, dateFormat: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Advanced Settings */}
          <TabsContent value="advanced" className="space-y-6">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <SettingsIcon className="w-5 h-5 mr-2" />
                  Advanced Settings
                </CardTitle>
                <CardDescription>Security and data management options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Two-Factor Authentication</Label>
                      <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                    </div>
                    <Switch
                      checked={settings.twoFactorAuth}
                      onCheckedChange={(checked) => setSettings({...settings, twoFactorAuth: checked})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Session Timeout (hours)</Label>
                    <Select value={settings.sessionTimeout} onValueChange={(value) => setSettings({...settings, sessionTimeout: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 hour</SelectItem>
                        <SelectItem value="4">4 hours</SelectItem>
                        <SelectItem value="8">8 hours</SelectItem>
                        <SelectItem value="24">24 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto Logout</Label>
                      <p className="text-sm text-muted-foreground">Automatically log out when session expires</p>
                    </div>
                    <Switch
                      checked={settings.autoLogout}
                      onCheckedChange={(checked) => setSettings({...settings, autoLogout: checked})}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-semibold">Data Management</h4>
                    <div className="flex space-x-2">
                      <Button variant="outline" onClick={handleExportData}>
                        <Download className="w-4 h-4 mr-2" />
                        Export Excel
                      </Button>
                      <Button variant="outline">
                        <Upload className="w-4 h-4 mr-2" />
                        Import Data
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;