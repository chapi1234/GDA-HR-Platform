import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';
import {
  Settings,
  User,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
  CreditCard,
} from 'lucide-react';
import logo from '../../assets/download.jpg';
import { getNavigationItems } from './navItems';
import NotificationBell from './NotificationBell';
import { unitLeaf } from '../../utils/orgPath';

export const Header = () => {
  const auth = useAuth();
  const { user, logout, roleLabel, canManage } = auth;
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const roleKey = `roles.${String(user?.role || '').toLowerCase()}`;
  const translatedRole = (() => {
    const val = t(roleKey);
    return val === roleKey ? roleLabel : val;
  })();

  const getDepartmentName = (dept) => {
    if (!dept) return '';
    if (typeof dept === 'string') {
      if (/^[0-9a-fA-F]{24}$/.test(dept)) return '';
      return dept;
    }
    if (typeof dept === 'object' && dept.name) return dept.name;
    return '';
  };

  const API_BASE = import.meta.env.VITE_API_URL;
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const [deptName, setDeptName] = useState('');

  useEffect(() => {
    let mounted = true;
    const dep = user?.department;
    if (!dep) return;
    if (typeof dep === 'object' && dep.name) {
      setDeptName(dep.name);
      return;
    }
    if (typeof dep === 'string' && !/^[0-9a-fA-F]{24}$/.test(dep)) {
      setDeptName(dep);
      return;
    }
    if (typeof dep === 'string') {
      (async () => {
        try {
          const res = await axios.get(`${API_BASE}/api/departments/${dep}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!mounted) return;
          setDeptName(res.data?.data?.name || '');
        } catch {
          // ignore
        }
      })();
    }
    return () => {
      mounted = false;
    };
  }, [user, API_BASE, token]);

  // Close drawer when route changes or viewport reaches desktop sidebar
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onResize = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return Sun;
      case 'dark':
        return Moon;
      default:
        return Monitor;
    }
  };
  const ThemeIcon = getThemeIcon();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const navigationItems = getNavigationItems(auth);

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          <Link
            to="/dashboard"
            className="flex items-center space-x-2 sm:space-x-3 min-w-0 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 shrink-0 bg-gradient-primary rounded-lg flex items-center justify-center overflow-hidden">
              <img src={logo} alt="GammoDA Logo" className="w-8 h-8 object-cover" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-lg sm:text-xl text-foreground truncate">{t("app.name")}</h1>
              <p className="text-xs text-muted-foreground -mt-1 hidden xs:block sm:block">
                {t("app.hrm")}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={toggleTheme}
              title={t("layout.themeCurrent", { theme })}
            >
              <ThemeIcon className="w-5 h-5" />
            </Button>

            <NotificationBell align="end" side="bottom" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 px-1.5 sm:px-2 hover:bg-accent"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.avatar} alt={user?.name} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.name?.split(' ').map((n) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  {/* Show name from tablet widths up; phones stay avatar-only */}
                  <div className="hidden sm:block text-left max-w-[120px] md:max-w-[160px]">
                    <p className="text-sm font-medium truncate">{user?.name}</p>
                    <Badge
                      variant={canManage ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {translatedRole}
                    </Badge>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <Badge variant="secondary" className="text-xs mt-1">
                    {unitLeaf(user?.unitPath) ||
                      deptName ||
                      getDepartmentName(user?.department) ||
                      translatedRole}
                  </Badge>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    {t("layout.profile")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/my-id" className="flex items-center">
                    <CreditCard className="w-4 h-4 mr-2" />
                    {t("layout.myId")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center">
                    <Settings className="w-4 h-4 mr-2" />
                    {t("layout.settings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  {t("layout.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Always visible below lg — was md:hidden which hid it on tablets */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label={mobileMenuOpen ? t("layout.closeMenu") : t("layout.openMenu")}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 transition-transform duration-200" />
              ) : (
                <Menu className="w-5 h-5 transition-transform duration-200" />
              )}
            </Button>
          </div>
        </div>

        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            mobileMenuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden">
            <nav
              className={`flex flex-col gap-1 py-3 border-t max-h-[min(70vh,32rem)] overflow-y-auto transition-opacity duration-300 ${
                mobileMenuOpen ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                      active
                        ? 'bg-accent text-primary'
                        : 'text-muted-foreground hover:text-primary hover:bg-accent/80'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};
