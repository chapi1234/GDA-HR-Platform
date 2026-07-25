"use client"

import { useState, useEffect } from "react"
import axios from 'axios'
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"
import { Button } from "../ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu"
import { Badge } from "../ui/badge"
import {
  Settings,
  User,
  LogOut,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
} from "lucide-react"
import logo  from '../../assets/download.jpg';
import { getNavigationItems } from "./navItems"
import NotificationBell from "./NotificationBell"
import { unitLeaf } from "../../utils/orgPath"

export const Sidebar = () => {
  const auth = useAuth()
  const { user, logout, roleLabel, canManage } = auth
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const getDepartmentName = (dept) => {
    if (!dept) return ""
    // avoid displaying raw ObjectId; treat 24-char hex strings as ids
    if (typeof dept === "string") {
      if (/^[0-9a-fA-F]{24}$/.test(dept)) return ""
      return dept
    }
    if (typeof dept === "object" && dept.name) return dept.name
    return ""
  }

  const API_BASE = import.meta.env.VITE_API_URL
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
  const [deptName, setDeptName] = useState('')

  useEffect(() => {
    let mounted = true
    const dep = user?.department
    if (!dep) return
    if (typeof dep === 'object' && dep.name) {
      setDeptName(dep.name)
      return
    }
    if (typeof dep === 'string' && !/^[0-9a-fA-F]{24}$/.test(dep)) {
      setDeptName(dep)
      return
    }
    if (typeof dep === 'string') {
      ;(async () => {
        try {
          const res = await axios.get(`${API_BASE}/api/departments/${dep}`, { headers: { Authorization: `Bearer ${token}` } })
          if (!mounted) return
          setDeptName(res.data?.data?.name || '')
        } catch (err) {
          // ignore
        }
      })()
    }
    return () => { mounted = false }
  }, [user, API_BASE, token])

  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark")
    } else if (theme === "dark") {
      setTheme("system")
    } else {
      setTheme("light")
    }
  }

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return Sun
      case "dark":
        return Moon
      default:
        return Monitor
    }
  }

  const ThemeIcon = getThemeIcon()

  const handleLogout = () => {
    logout()
  }

  const navigationItems = getNavigationItems(auth)

  const isActiveLink = (href) => location.pathname === href

  return (
    <aside
      className={`hidden lg:flex lg:sticky top-0 lg:h-screen flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${
        isCollapsed ? "w-20" : "w-64"
      } flex-shrink-0`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 ml-5">
        <Link
          to="/dashboard"
          className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <img src={logo} alt="GammoDA Logo" className="w-8 h-8 object-cover rounded" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-bold text-xl text-foreground">GammoDA</h1>
              <p className="text-xs text-muted-foreground -mt-1">HRM System</p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = isActiveLink(item.href);
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={`flex items-center rounded-md transition-all duration-200 ${
                    isCollapsed
                      ? "justify-center px-0 py-2.5"
                      : "space-x-3 px-3 py-2"
                  } ${
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0 block" />
                  {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Controls */}
      <div className="border-t border-sidebar-border p-4 space-y-3">
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"} gap-2`}>
          {!isCollapsed && (
            <span className="text-sm text-sidebar-foreground px-1">Notifications</span>
          )}
          <NotificationBell align="end" side="top" />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className={`w-full text-sidebar-foreground hover:bg-sidebar-accent ${
            isCollapsed ? "justify-center px-0" : "justify-start"
          }`}
          title={`Current theme: ${theme}`}
        >
          <ThemeIcon className="w-5 h-5 flex-shrink-0 block" />
          {!isCollapsed && <span className="text-sm ml-2">Theme</span>}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={`w-full text-sidebar-foreground hover:bg-sidebar-accent ${
                isCollapsed ? "justify-center px-0 py-2" : "justify-start"
              }`}
            >
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={user?.profileImage || user?.avatar || "/placeholder.svg"} alt={user?.name} />
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                  {user?.name?.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex-1 text-left ml-2 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <Badge variant={canManage ? "default" : "secondary"} className="text-xs mt-1">
                    {roleLabel}
                  </Badge>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <Badge variant="secondary" className="text-xs mt-1">
                {unitLeaf(user?.unitPath) || deptName || getDepartmentName(user?.department) || roleLabel}
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

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`w-full text-sidebar-foreground hover:bg-sidebar-accent ${
            isCollapsed ? "justify-center px-0" : "justify-start"
          }`}
        >
          <ChevronDown
            className={`w-5 h-5 flex-shrink-0 transition-transform ${
              isCollapsed ? "rotate-90" : "-rotate-90"
            }`}
          />
          {!isCollapsed && <span className="text-sm ml-2">Collapse</span>}
        </Button>
      </div>
    </aside>
  )
}
