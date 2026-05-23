import { Menu, Bell, Search, Sun } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { getNotifications } from '../../lib/api';

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export default function Header({ onMenuClick, title }: HeaderProps) {
  const { profile } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const unreadAlerts = notifications.filter(a => !a.is_read).length;

  const severityColors: Record<string, string> = {
    critical: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!profile?.id) return setNotifications([]);
      try {
        const data = await getNotifications(profile.id);
        if (!mounted) return;
        setNotifications(data ?? []);
      } catch (e) {
        console.error('Failed to load notifications', e);
      }
    }
    load();
    return () => { mounted = false; };
  }, [profile?.id]);

  return (
    <header className="flex-shrink-0 h-14 bg-gray-950/80 backdrop-blur border-b border-gray-800/60 flex items-center px-4 gap-4 relative z-30">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-400 hover:text-gray-200 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {title && (
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">{title}</h2>
        </div>
      )}

      <div className="flex-1" />

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 bg-gray-800/60 border border-gray-700/60 rounded-lg px-3 py-1.5 w-48">
        <Search className="w-3.5 h-3.5 text-gray-500" />
        <input
          type="text"
          placeholder="Search..."
          className="bg-transparent text-xs text-gray-400 placeholder-gray-600 focus:outline-none w-full"
        />
      </div>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-all"
        >
          <Bell className="w-4.5 h-4.5 w-5 h-5" />
          {unreadAlerts > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-gray-950" />
          )}
        </button>

        {showNotifications && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />
            <div className="absolute right-0 top-11 w-80 bg-gray-900 border border-gray-700/60 rounded-2xl shadow-2xl z-40 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                <span className="text-xs text-amber-400 font-medium">{unreadAlerts} unread</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.slice(0, 4).map(n => (
                  <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${!n.is_read ? 'bg-gray-800/20' : ''}`}>
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${severityColors[n.severity ?? 'info']}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-200 truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-gray-600 mt-1">
                        {new Date(n.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 bg-gray-900">
                <button className="text-xs text-amber-400 hover:text-amber-300 transition-colors w-full text-center">
                  View all notifications
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
          <span className="text-amber-400 text-xs font-bold">
            {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
        <div className="hidden md:block">
          <p className="text-xs font-medium text-white leading-none">{profile?.full_name || 'User'}</p>
          <p className="text-[10px] text-gray-500 capitalize mt-0.5">{profile?.role}</p>
        </div>
      </div>
    </header>
  );
}
