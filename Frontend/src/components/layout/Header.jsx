import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
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
  Bell,
  Settings,
  User,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import logo from '../../assets/download.jpg';
import { getNavigationItems } from './navItems';
import NotificationBell from './NotificationBell';

export const Header = () => {
  const auth = useAuth();
  const { user, logout, roleLabel, canManage } = auth;
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getDepartmentName = (dept) => {
    if (!dept) return '';
    // don't show raw ObjectId; treat 24-char hex as id
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
          const res = await axios.get(`${API_BASE}/api/departments/${dep}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!mounted) return;
          setDeptName(res.data?.data?.name || '');
        } catch (err) {
          // ignore
        }
      })();
    }
    return () => { mounted = false };
  }, [user, API_BASE, token]);

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
    <header className="sticky top-0 z-50 lg:hidden bg-background border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/dashboard"
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <img src={logo} alt="GammoDA Logo" className="w-8 h-8 object-cover" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-foreground">GammoDA</h1>
              <p className="text-xs text-muted-foreground -mt-1">HRM System</p>
            </div>
          </Link>

          {/* User & Menu */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              title={`Current theme: ${theme}`}
            >
              <ThemeIcon className="w-5 h-5" />
            </Button>

            <NotificationBell align="end" side="bottom" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 hover:bg-accent">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.avatar} alt={user?.name} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.name?.split(' ').map((n) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <Badge variant={canManage ? 'default' : 'secondary'} className="text-xs">
                      {roleLabel}
                    </Badge>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <Badge variant="secondary" className="text-xs mt-1">
                    {user?.unitPath || deptName || getDepartmentName(user?.department) || roleLabel}
                  </Badge>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="py-4 border-t animate-fade-in">
            <nav className="flex flex-col space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-primary hover:bg-accent transition-all duration-200"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};
