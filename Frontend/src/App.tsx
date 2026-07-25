import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from 'react-toastify';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Header } from './components/layout/Header';
import { AuthForm } from './components/auth/AuthForm';
import RoleRoute from './components/auth/RoleRoute';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import Departments from './pages/Departments';
import Sectors from './pages/Sectors';
import AdminConsole from './pages/AdminConsole';
import Attendance from './pages/Attendance';
import Salary from './pages/Salary';
import SalaryAdvances from './pages/SalaryAdvances';
import LeaveRequests from './pages/LeaveRequests';
import Recruitment from './pages/Recruitment';
import Profile from './pages/Profile';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Calendar from './pages/Calendar';
import Goals from './pages/Goals';
import Payslips from './pages/Payslips';
import NotFound from "./pages/NotFound";
import EmployeeDevices from './pages/EmployeeDevices';
import HRDeviceManagement from './pages/HRDeviceManagement';
import 'react-toastify/dist/ReactToastify.css';
import { Sidebar } from "./components/layout/Sidebar";


const queryClient = new QueryClient();

  const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!isAuthenticated) return <AuthForm />;

    return (
      <div className="min-h-screen w-full flex flex-col">
        {/* Mobile / tablet header (sidebar takes over at lg) */}
        <div className="block lg:hidden">
          <Header />
        </div>

        <div className="flex flex-1">
          {/* Sidebar visible only on lg */}
          <div className="hidden lg:flex lg:flex-shrink-0">
            <Sidebar />
          </div>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    );
  };

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/auth" element={<AuthForm />} />
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/employees" 
        element={
          <ProtectedRoute>
            <RoleRoute capability="canManage">
              <Employees />
            </RoleRoute>
          </ProtectedRoute>
        } 
      />
      <Route
        path="/employees/:id"
        element={
          <ProtectedRoute>
            <RoleRoute capability="canManage">
              <EmployeeDetail />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route 
        path="/departments" 
        element={
          <ProtectedRoute>
            <Navigate to="/sectors" replace />
          </ProtectedRoute>
        } 
      />
      <Route
        path="/sectors"
        element={
          <ProtectedRoute>
            <RoleRoute capability="canManage">
              <Sectors />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-console"
        element={
          <ProtectedRoute>
            <RoleRoute capability="canAccessAdminConsole">
              <AdminConsole />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route 
        path="/attendance" 
        element={
          <ProtectedRoute>
            <Attendance />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/salary" 
        element={
          <ProtectedRoute>
            <Salary />
          </ProtectedRoute>
        } 
      />
      <Route
        path="/salary-advances"
        element={
          <ProtectedRoute>
            <RoleRoute capability="canViewSalaryAdvances">
              <SalaryAdvances />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route 
        path="/leave-requests" 
        element={
          <ProtectedRoute>
            <LeaveRequests />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/recruitment" 
        element={
          <ProtectedRoute>
            <RoleRoute capability="canRecruit">
              <Recruitment />
            </RoleRoute>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/profile" 
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } 
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/calendar" 
        element={
          <ProtectedRoute>
            <Calendar />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/goals" 
        element={
          <ProtectedRoute>
            <Goals />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/payslips" 
        element={
          <ProtectedRoute>
            <Payslips />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/my-devices" 
        element={
          <ProtectedRoute>
            <EmployeeDevices />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/device-management" 
        element={
          <ProtectedRoute>
            <RoleRoute capability="canManageDevices">
              <HRDeviceManagement />
            </RoleRoute>
          </ProtectedRoute>
        } 
      />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
            />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
