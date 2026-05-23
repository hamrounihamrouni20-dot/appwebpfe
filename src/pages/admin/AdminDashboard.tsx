import { Users, Wrench, Building2, Zap, Ticket, Bell, TrendingUp, Activity } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatCard from '../../components/ui/StatCard';
import ProductionBarChart from '../../components/charts/ProductionBarChart';
import Badge from '../../components/ui/Badge';
import { useEffect, useMemo, useState } from 'react';
import { getUsers, getTechnicians, getInstallations, getTickets, getAlerts } from '../../lib/api';

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [techs, setTechs] = useState<any[]>([]);
  const [installations, setInstallations] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [u, t, inst, tk, al] = await Promise.all([
          getUsers(),
          getTechnicians(),
          getInstallations(),
          getTickets(),
          getAlerts(),
        ]);
        if (!mounted) return;
        setUsers(u ?? []);
        setTechs(t ?? []);
        setInstallations(inst ?? []);
        setTickets(tk ?? []);
        setAlerts(al ?? []);
      } catch (e) {
        console.error('Failed loading dashboard data', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const openTickets = tickets.filter((t: any) => t.status !== 'resolved' && t.status !== 'closed');
  const criticalAlerts = alerts.filter((a: any) => a.severity === 'critical' && !a.is_resolved);

  const totalCapacity = useMemo(() => installations.reduce((sum, inst) => sum + (inst.capacity_kw ?? 0), 0), [installations]);
  const dailyData = useMemo(() => {
    return new Array(10).fill(null).map((_, index) => ({
      label: `Day ${index + 1}`,
      kwh: Math.max(0, (installations.length * 10) + index * 2),
    }));
  }, [installations.length]);

  const recentTickets = tickets.slice(0, 5);
  const recentAlerts = alerts.slice(0, 4);

  return (
    <AppLayout title="Admin Overview">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">System Overview</h2>
          <p className="text-sm text-gray-400 mt-0.5">Global platform monitoring dashboard</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={users.length} icon={<Users className="w-5 h-5" />} color="blue"
            trend={{ value: 8, label: '2 new this month' }} />
          <StatCard label="Technicians" value={techs.length} icon={<Wrench className="w-5 h-5" />} color="cyan" />
          <StatCard label="Installations" value={installations.length} icon={<Building2 className="w-5 h-5" />} color="amber"
            trend={{ value: installations.length > 0 ? 1 : 0, label: 'new this month' }} />
          <StatCard label="Total Capacity" value={totalCapacity.toFixed(1)} unit="kWp" icon={<Zap className="w-5 h-5" />} color="emerald"
            glowing />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Open Tickets" value={openTickets.length} icon={<Ticket className="w-5 h-5" />} color="rose"
            subtitle={`${openTickets.filter((t: any) => t.priority === 'critical').length} critical`} />
          <StatCard label="Active Alerts" value={alerts.filter((a: any) => !a.is_resolved).length} icon={<Bell className="w-5 h-5" />} color="amber"
            subtitle={`${criticalAlerts.length} critical`} />
          <StatCard label="Monthly Energy" value={(installations.length * 125).toFixed(0)} unit="kWh" icon={<TrendingUp className="w-5 h-5" />} color="emerald"
            trend={{ value: 12, label: 'vs last month' }} />
          <StatCard label="System Uptime" value="99.1" unit="%" icon={<Activity className="w-5 h-5" />} color="blue" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Global Energy Production</h3>
                <p className="text-xs text-gray-500 mt-0.5">All installations combined — last 10 days</p>
              </div>
              <Badge variant="success" dot>Live</Badge>
            </div>
            <ProductionBarChart data={dailyData} height={220} />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Installation Status</h3>
            <div className="space-y-3">
              {installations.map(inst => {
                const statusColor = {
                  active: 'bg-emerald-500',
                  maintenance: 'bg-amber-500',
                  inactive: 'bg-gray-500',
                  fault: 'bg-red-500',
                }[inst.status as string] ?? 'bg-gray-500';

                return (
                  <div key={inst.id} className="flex items-center gap-3 bg-gray-800/40 rounded-xl p-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColor} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{inst.name}</p>
                      <p className="text-[10px] text-gray-500">{inst.capacity_kw} kWp · {inst.panel_count} panels</p>
                    </div>
                    <Badge variant={inst.status === 'active' ? 'success' : inst.status === 'maintenance' ? 'warning' : 'error'}>
                      {inst.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Recent Tickets</h3>
              <Badge variant="warning">{openTickets.length} open</Badge>
            </div>
            <div className="divide-y divide-gray-800/60">
              {recentTickets.map(ticket => {
                const priorityColors = { low: 'bg-gray-500', medium: 'bg-amber-500', high: 'bg-orange-500', critical: 'bg-red-500' };
                return (
                  <div key={ticket.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-800/30 transition-colors">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${priorityColors[ticket.priority]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{ticket.title}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{new Date(ticket.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={ticket.status === 'resolved' ? 'success' : 'info'} size="sm">
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Active Alerts</h3>
              <Badge variant="error">{criticalAlerts.length} critical</Badge>
            </div>
            <div className="divide-y divide-gray-800/60">
              {recentAlerts.map(alert => {
                const severityColor = { critical: 'text-red-400', warning: 'text-amber-400', info: 'text-blue-400' }[alert.severity];
                const dotColor = { critical: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-blue-500' }[alert.severity];
                return (
                  <div key={alert.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-800/30 transition-colors">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${severityColor}`}>{alert.title}</p>
                      <p className="text-[10px] text-gray-500 truncate mt-0.5">{alert.message}</p>
                    </div>
                    <span className="text-[10px] text-gray-600 flex-shrink-0">
                      {new Date(alert.triggered_at).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
