import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// User pages
import UserDashboard from './pages/user/UserDashboard';
import AnalyticsPage from './pages/user/AnalyticsPage';
import PredictionsPage from './pages/user/PredictionsPage';
import AIAssistantPage from './pages/user/AIAssistantPage';
import TicketsPage from './pages/user/TicketsPage';
import AlertsPage from './pages/user/AlertsPage';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UsersPage from './pages/admin/UsersPage';
import TechniciansPage from './pages/admin/TechniciansPage';
import AdminTicketsPage from './pages/admin/AdminTicketsPage';
import InstallationsPage from './pages/admin/InstallationsPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import SystemPage from './pages/admin/SystemPage';
import UserDetailsPage from './pages/admin/UserDetailsPage';

// Technician pages
import TechDashboard from './pages/technician/TechDashboard';
import TechTicketsPage from './pages/technician/TechTicketsPage';
import TechInstallationsPage from './pages/technician/TechInstallationsPage';
import TechActivityPage from './pages/technician/TechActivityPage';

// Shared
import SettingsPage from './pages/SettingsPage';
import { PageLoader } from './components/ui/LoadingSpinner';

function DashboardRedirect() {
  const { role, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!role) return <Navigate to="/login" replace />;
  if (role === 'admin') return <AdminDashboard />;
  if (role === 'technician') return <TechDashboard />;
  return <UserDashboard />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/update-password" element={<ResetPasswordPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />

      {/* User routes */}
      <Route path="/analytics" element={<ProtectedRoute allowedRoles={['user','admin']}><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/predictions" element={<ProtectedRoute allowedRoles={['user','admin']}><PredictionsPage /></ProtectedRoute>} />
      <Route path="/assistant" element={<ProtectedRoute allowedRoles={['user','admin']}><AIAssistantPage /></ProtectedRoute>} />
      <Route path="/tickets" element={<ProtectedRoute allowedRoles={['user','admin']}><TicketsPage /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute allowedRoles={['user','admin']}><AlertsPage /></ProtectedRoute>} />

      {/* Admin routes */}
      <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><UsersPage /></ProtectedRoute>} />
        <Route path="/admin/users/:id" element={<ProtectedRoute allowedRoles={['admin']}><UserDetailsPage /></ProtectedRoute>} />
      <Route path="/admin/technicians" element={<ProtectedRoute allowedRoles={['admin']}><TechniciansPage /></ProtectedRoute>} />
      <Route path="/admin/tickets" element={<ProtectedRoute allowedRoles={['admin']}><AdminTicketsPage /></ProtectedRoute>} />
      <Route path="/admin/installations" element={<ProtectedRoute allowedRoles={['admin']}><InstallationsPage /></ProtectedRoute>} />
      <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin']}><AdminAnalyticsPage /></ProtectedRoute>} />
      <Route path="/admin/system" element={<ProtectedRoute allowedRoles={['admin']}><SystemPage /></ProtectedRoute>} />

      {/* Technician routes */}
      <Route path="/tech/tickets" element={<ProtectedRoute allowedRoles={['technician','admin']}><TechTicketsPage /></ProtectedRoute>} />
      <Route path="/tech/installations" element={<ProtectedRoute allowedRoles={['technician','admin']}><TechInstallationsPage /></ProtectedRoute>} />
      <Route path="/tech/activity" element={<ProtectedRoute allowedRoles={['technician','admin']}><TechActivityPage /></ProtectedRoute>} />

      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 15000,
      },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
    </QueryClientProvider>
  );
}
