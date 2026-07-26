import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
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
  const { language, setLanguage, t } = useLanguage();
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
    language: language || 'en',
    timezone: 'UTC+3',
    dateFormat: 'DD/MM/YYYY',
    
    // Advanced
    twoFactorAuth: false,
    sessionTimeout: '8',
    autoLogout: true,
    fontSize: 'medium',
    compactMode: false,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem('userSettings');
      if (raw) {
        const saved = JSON.parse(raw);
        setSettings((prev) => ({
          ...prev,
          ...saved,
          language: language || saved.language || 'en',
        }));
      }
    } catch {
      // ignore
    }
  }, [language]);

  const colorSchemes = [
    { value: 'blue', label: 'Blue', color: 'bg-blue-500' },
    { value: 'green', label: 'Green', color: 'bg-green-500' },
    { value: 'purple', label: 'Purple', color: 'bg-purple-500' },
    { value: 'orange', label: 'Orange', color: 'bg-orange-500' },
    { value: 'red', label: 'Red', color: 'bg-red-500' },
    { value: 'teal', label: 'Teal', color: 'bg-teal-500' }
  ];

  const handleLanguageChange = (value) => {
    const lang = value === 'am' ? 'am' : 'en';
    setSettings((prev) => ({ ...prev, language: lang }));
    setLanguage(lang);
    toast.success(lang === 'am' ? 'ቋንቋ ተቀይሯል' : 'Language updated');
  };

  const handleSaveSettings = () => {
    localStorage.setItem('userSettings', JSON.stringify({ ...settings, language }));
    toast.success(t('settings.saved'));
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
    toast.success(t('settings.exported'));
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("settings.title")}</h1>
            <p className="text-muted-foreground">{t("settings.subtitle")}</p>
          </div>
          <Button style={button} onClick={handleSaveSettings} className="btn-gradient">
            <Save className="w-4 h-4 mr-2" />
            {t("settings.saveSettings")}
          </Button>
        </div>

        <Tabs defaultValue="appearance" className="w-full">
          <TabsList style={marginStyle} className="flex flex-wrap w-full gap-2 mb-6">
            <TabsTrigger value="appearance">{t("settings.tabs.appearance")}</TabsTrigger>
            <TabsTrigger value="notifications">{t("settings.tabs.notifications")}</TabsTrigger>
            <TabsTrigger value="privacy">{t("settings.tabs.privacy")}</TabsTrigger>
            <TabsTrigger value="regional">{t("settings.tabs.regional")}</TabsTrigger>
            <TabsTrigger value="advanced">{t("settings.tabs.advanced")}</TabsTrigger>
          </TabsList>

          {/* Appearance Settings */}
          <TabsContent value="appearance" className="space-y-6">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Palette className="w-5 h-5 mr-2" />
                  Appearance & Theme
                </CardTitle>
                <CardDescription>{t("settings.appearanceDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("settings.themeMode")}</Label>
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">
                          <div className="flex items-center">
                            <Sun className="w-4 h-4 mr-2" />
                            {t("settings.light")}
                          </div>
                        </SelectItem>
                        <SelectItem value="dark">
                          <div className="flex items-center">
                            <Moon className="w-4 h-4 mr-2" />
                            {t("settings.dark")}
                          </div>
                        </SelectItem>
                        <SelectItem value="system">
                          <div className="flex items-center">
                            <Monitor className="w-4 h-4 mr-2" />
                            {t("settings.system")}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("settings.colorScheme")}</Label>
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
                <CardDescription>{t("settings.notificationsDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <div className="space-y-0.5">
                      <Label className="cursor-pointer">{t("settings.emailNotifications")}</Label>
                      <p className="text-sm text-muted-foreground">{t("settings.emailNotificationsDesc")}</p>
                    </div>
                    <Switch
                      checked={settings.emailNotifications}
                      onCheckedChange={(checked) => setSettings({...settings, emailNotifications: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <div className="space-y-0.5">
                      <Label className="cursor-pointer">{t("settings.pushNotifications")}</Label>
                      <p className="text-sm text-muted-foreground">{t("settings.pushNotificationsDesc")}</p>
                    </div>
                    <Switch
                      checked={settings.pushNotifications}
                      onCheckedChange={(checked) => setSettings({...settings, pushNotifications: checked})}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <div className="space-y-0.5">
                      <Label className="cursor-pointer">{t("settings.weeklyReports")}</Label>
                      <p className="text-sm text-muted-foreground">{t("settings.weeklyReportsDesc")}</p>
                    </div>
                    <Switch
                      checked={settings.weeklyReports}
                      onCheckedChange={(checked) => setSettings({...settings, weeklyReports: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <div className="space-y-0.5">
                      <Label className="cursor-pointer">{t("settings.leaveReminders")}</Label>
                      <p className="text-sm text-muted-foreground">{t("settings.leaveRemindersDesc")}</p>
                    </div>
                    <Switch
                      checked={settings.leaveReminders}
                      onCheckedChange={(checked) => setSettings({...settings, leaveReminders: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <div className="space-y-0.5">
                      <Label className="cursor-pointer">{t("settings.attendanceAlerts")}</Label>
                      <p className="text-sm text-muted-foreground">{t("settings.attendanceAlertsDesc")}</p>
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
                  {t("settings.privacyTitle")}
                </CardTitle>
                <CardDescription>{t("settings.privacyDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("settings.profileVisibility")}</Label>
                    <Select value={settings.profileVisibility} onValueChange={(value) => setSettings({...settings, profileVisibility: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">{t("settings.everyone")}</SelectItem>
                        <SelectItem value="team">{t("settings.team")}</SelectItem>
                        <SelectItem value="department">{t("settings.team")}</SelectItem>
                        <SelectItem value="private">{t("settings.private")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t("settings.showOnlineStatus")}</Label>
                    </div>
                    <Switch
                      checked={settings.showOnlineStatus}
                      onCheckedChange={(checked) => setSettings({...settings, showOnlineStatus: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t("settings.shareCalendar")}</Label>
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
                  {t("settings.languageRegionTitle")}
                </CardTitle>
                <CardDescription>{t("settings.languageRegionDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("settings.language")}</Label>
                    <Select value={language} onValueChange={handleLanguageChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">{t("settings.languageEn")}</SelectItem>
                        <SelectItem value="am">{t("settings.languageAm")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("settings.timezone")}</Label>
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
                    <Label>{t("settings.dateFormat")}</Label>
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
                  {t("settings.advancedTitle")}
                </CardTitle>
                <CardDescription>{t("settings.advancedDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t("settings.twoFactor")}</Label>
                    </div>
                    <Switch
                      checked={settings.twoFactorAuth}
                      onCheckedChange={(checked) => setSettings({...settings, twoFactorAuth: checked})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("settings.sessionTimeout")}</Label>
                    <Select value={settings.sessionTimeout} onValueChange={(value) => setSettings({...settings, sessionTimeout: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                        <SelectItem value="8">8</SelectItem>
                        <SelectItem value="24">24</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t("settings.autoLogout")}</Label>
                    </div>
                    <Switch
                      checked={settings.autoLogout}
                      onCheckedChange={(checked) => setSettings({...settings, autoLogout: checked})}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-semibold">{t("settings.exportData")}</h4>
                    <p className="text-sm text-muted-foreground">{t("settings.exportDataDesc")}</p>
                    <div className="flex space-x-2">
                      <Button variant="outline" onClick={handleExportData}>
                        <Download className="w-4 h-4 mr-2" />
                        {t("settings.exportButton")}
                      </Button>
                      <Button variant="outline">
                        <Upload className="w-4 h-4 mr-2" />
                        {t("common.import")}
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