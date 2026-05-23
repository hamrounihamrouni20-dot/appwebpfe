import { NavLink, useNavigate } from 'react-router-dom';
import {
  Sun, LayoutDashboard, BarChart3, BrainCircuit, MessageSquare,
  Ticket, Bell, Users, Wrench, Settings, LogOut, ChevronLeft,
  Building2, X, ShieldCheck, ClipboardList, Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../lib/database.types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navByRole: Record<UserRole, NavItem[]> = {
  user: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'AI Predictions', path: '/predictions', icon: BrainCircuit },
    { label: 'AI Assistant', path: '/assistant', icon: MessageSquare },
    { label: 'Support Tickets', path: '/tickets', icon: Ticket },
    { label: 'Alerts', path: '/alerts', icon: Bell },
  ],
  admin: [
    { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Users', path: '/admin/users', icon: Users },
    { label: 'Technicians', path: '/admin/technicians', icon: Wrench },
    { label: 'Tickets', path: '/admin/tickets', icon: ClipboardList },
    { label: 'Installations', path: '/admin/installations', icon: Building2 },
    { label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
    { label: 'System', path: '/admin/system', icon: ShieldCheck },
  ],
  technician: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'My Tickets', path: '/tech/tickets', icon: ClipboardList },
    { label: 'Installations', path: '/tech/installations', icon: Building2 },
    { label: 'Activity', path: '/tech/activity', icon: Activity },
  ],
};

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ collapsed, onCollapse, mobileOpen, onMobileClose }: SidebarProps) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const navItems = navByRole[role ?? 'user'] ?? [];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const roleColors: Record<UserRole, string> = {
    admin: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    technician: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    user: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-800/60 ${collapsed ? 'justify-center' : ''}`}>
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Sun className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-white font-bold text-base leading-none">SolarWatch</h1>
            <p className="text-gray-500 text-[10px] mt-0.5">PV Intelligence</p>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => onCollapse(true)}
            className="ml-auto text-gray-600 hover:text-gray-400 transition-colors hidden lg:block"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {!collapsed && (
          <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-3 mb-2">
            {role === 'admin' ? 'Management' : role === 'technician' ? 'Operations' : 'My System'}
          </p>
        )}
        <ul className="space-y-0.5">
          {navItems.map(item => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/dashboard'}
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative
                  ${isActive
                    ? 'bg-amber-500/15 text-amber-400 shadow-inner'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/60'
                  }
                  ${collapsed ? 'justify-center' : ''}`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-amber-500 rounded-r-full" />
                    )}
                    <item.icon className={`w-4.5 h-4.5 flex-shrink-0 w-5 h-5 ${isActive ? 'text-amber-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
                    {!collapsed && <span>{item.label}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User section */}
      <div className={`border-t border-gray-800/60 px-2 py-3 space-y-1`}>
        <NavLink
          to="/settings"
          onClick={onMobileClose}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-400 hover:text-gray-100 hover:bg-gray-800/60 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!collapsed && 'Settings'}
        </NavLink>
        <button
          onClick={handleSignOut}
          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && 'Sign out'}
        </button>

        {!collapsed && profile && (
          <div className="flex items-center gap-3 px-3 py-3 mt-1 bg-gray-800/40 rounded-xl border border-gray-800">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-amber-400 text-xs font-bold">
                {profile.full_name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-medium truncate">{profile.full_name || 'User'}</p>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border capitalize ${roleColors[role ?? 'user']}`}>
                {role}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-950 border-r border-gray-800/60 transition-transform duration-300 lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button
          onClick={onMobileClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col flex-shrink-0 bg-gray-950 border-r border-gray-800/60 transition-all duration-300 ${collapsed ? 'w-[68px]' : 'w-60'}`}>
        {collapsed ? (
          <button
            onClick={() => onCollapse(false)}
            className="absolute top-[22px] left-[52px] z-10 w-5 h-5 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors"
          >
            <ChevronLeft className="w-3 h-3 rotate-180" />
          </button>
        ) : null}
        {sidebarContent}
      </aside>
    </>
  );
}
