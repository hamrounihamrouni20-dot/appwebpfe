import { useEffect, useState } from 'react';
import { Bell, Thermometer, TrendingDown, WifiOff, Activity, CheckCircle2, Filter } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { getAlerts, getInstallationsByUser, markAlertAsRead, resolveAlert } from '../../lib/api';
import type { Alert, AlertType, AlertSeverity } from '../../lib/database.types';

function alertIcon(type: AlertType) {
  const icons = {
    high_temperature: <Thermometer className="w-5 h-5" />,
    low_production: <TrendingDown className="w-5 h-5" />,
    system_offline: <WifiOff className="w-5 h-5" />,
    sensor_anomaly: <Activity className="w-5 h-5" />,
    general: <Bell className="w-5 h-5" />,
  };
  return icons[type] ?? icons.general;
}

function severityColors(severity: AlertSeverity) {
  const map = {
    critical: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: 'text-red-400 bg-red-500/10 border-red-500/20', badge: 'error' as const },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-400 bg-amber-500/10 border-amber-500/20', badge: 'warning' as const },
    info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-400 bg-blue-500/10 border-blue-500/20', badge: 'info' as const },
  };
  return map[severity];
}

export default function AlertsPage() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');

  useEffect(() => {
    async function loadAlerts() {
      if (!profile?.id) return;
      try {
        const installations = await getInstallationsByUser(profile.id);
        const allAlerts = await getAlerts();
        const installationIds = new Set(installations.map(inst => inst.id));
        setAlerts(allAlerts.filter(alert => installationIds.has(alert.installation_id)));
      } catch (error) {
        console.error('Failed to load alerts', error);
      }
    }
    loadAlerts();
  }, [profile?.id]);

  const filtered = alerts.filter(a => {
    if (filter === 'unread') return !a.is_read;
    if (filter === 'critical') return a.severity === 'critical';
    return true;
  });

  const markRead = async (id: string) => {
    try {
      await markAlertAsRead(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    } catch (error) {
      console.error('Failed to mark alert read', error);
    }
  };

  const markResolved = async (id: string) => {
    try {
      await resolveAlert(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_resolved: true, resolved_at: new Date().toISOString() } : a));
    } catch (error) {
      console.error('Failed to resolve alert', error);
    }
  };

  const markAllRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
  };

  const unread = alerts.filter(a => !a.is_read).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.is_resolved).length;

  return (
    <AppLayout title="Alerts">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">System Alerts</h2>
            <p className="text-sm text-gray-400 mt-0.5">{unread} unread, {criticalCount} critical</p>
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-all"
            >
              <CheckCircle2 className="w-4 h-4" /> Mark all read
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Alerts', value: alerts.length, color: 'text-gray-300', bg: 'bg-gray-800/60', border: 'border-gray-700' },
            { label: 'Unread', value: unread, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
            { label: 'Critical', value: criticalCount, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
            { label: 'Resolved', value: alerts.filter(a => a.is_resolved).length, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} border ${c.border} rounded-2xl p-4`}>
              <p className="text-xs text-gray-500 mb-1">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          {(['all', 'unread', 'critical'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all capitalize ${filter === f ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
              <Bell className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No alerts</p>
              <p className="text-sm text-gray-600 mt-1">Your system is running smoothly</p>
            </div>
          ) : (
            filtered.map(alert => {
              const colors = severityColors(alert.severity);
              return (
                <div
                  key={alert.id}
                  className={`relative bg-gray-900 border rounded-2xl p-5 transition-all hover:border-gray-700 ${!alert.is_read ? `${colors.bg} ${colors.border}` : 'border-gray-800'}`}
                >
                  {!alert.is_read && (
                    <div className="absolute top-4 right-4 w-2 h-2 bg-amber-500 rounded-full" />
                  )}
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${colors.icon}`}>
                      {alertIcon(alert.alert_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-white">{alert.title}</h3>
                          <p className="text-xs text-gray-400 mt-1">{alert.message}</p>
                        </div>
                        <Badge variant={colors.badge} dot>{alert.severity}</Badge>
                      </div>
                      <div className="flex items-center flex-wrap gap-3 mt-3">
                        <span className="text-xs text-gray-600">
                          {new Date(alert.triggered_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {alert.is_resolved && (
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                          </span>
                        )}
                        <div className="ml-auto flex gap-2">
                          {!alert.is_read && (
                            <button
                              onClick={() => markRead(alert.id)}
                              className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                            >
                              Mark read
                            </button>
                          )}
                          {!alert.is_resolved && (
                            <button
                              onClick={() => markResolved(alert.id)}
                              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
