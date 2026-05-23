import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Building2, Zap, Users, Sun } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import ProductionBarChart from '../../components/charts/ProductionBarChart';
import PowerChart from '../../components/charts/PowerChart';
import { getInstallations, getAlerts, getTickets } from '../../lib/api';
import { RadialBarChart, RadialBar, ResponsiveContainer, Legend, Tooltip, PieChart, Pie, Cell } from 'recharts';

export default function AdminAnalyticsPage() {
  const [installations, setInstallations] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [dailyProduction, setDailyProduction] = useState<{ label: string; kwh: number }[]>([]);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const [inst, al, tk] = await Promise.all([getInstallations(), getAlerts(), getTickets()]);
        setInstallations(inst ?? []);
        setAlerts(al ?? []);
        setTickets(tk ?? []);
        const chartRows = new Array(14).fill(null).map((_, index) => ({
          label: new Date(Date.now() - (13 - index) * 24 * 60 * 60 * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
          kwh: Math.round(((inst?.length ?? 1) * 8 + index * 2) * 10) / 10,
        }));
        setDailyProduction(chartRows);
      } catch (error) {
        console.error('Failed to load admin analytics', error);
      }
    }
    loadAnalytics();
  }, []);

  const monthlyChart = dailyProduction;
  const hourlyData = Array.from({ length: 14 }, (_, h) => {
    const hour = h + 6;
    const irradiance = Math.max(0, 900 * Math.sin(((hour - 6) / 14) * Math.PI));
    return {
      time: `${hour}:00`,
      power: Math.round((irradiance * 0.08) * 100) / 100,
    };
  });

  const instPerformance = installations.slice(0, 3).map((inst, i) => ({
    name: inst.name,
    value: [97, 88, 73][i] ?? 85,
    fill: ['#f59e0b', '#10b981', '#06b6d4'][i] ?? '#f59e0b',
  }));

  const energyMix = installations.slice(0, 3).map((inst, idx) => ({
    name: inst.name,
    value: Math.max(1, Math.round((inst.capacity_kw ?? 1) * 120)),
    fill: ['#f59e0b', '#10b981', '#06b6d4'][idx] ?? '#f59e0b',
  }));

  const totalEnergy = monthlyChart.reduce((sum, item) => sum + item.kwh, 0);
  const totalInstallations = installations.length;

  return (
    <AppLayout title="Analytics">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Company Analytics</h2>
          <p className="text-sm text-gray-400 mt-0.5">Aggregated performance across all installations</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Monthly Energy', value: `${totalEnergy.toFixed(0)} kWh`, change: '+14%', icon: Zap, color: 'text-amber-400' },
            { label: 'Total Installations', value: `${totalInstallations}`, change: '+1 new', icon: Building2, color: 'text-blue-400' },
            { label: 'Avg Performance', value: '86%', change: '+2.1%', icon: TrendingUp, color: 'text-emerald-400' },
            { label: 'CO₂ Avoided', value: '1.05 t', change: '+14%', icon: Sun, color: 'text-cyan-400' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all">
              <div className="flex items-center justify-between mb-3">
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                <span className="text-xs font-medium text-emerald-400">{kpi.change}</span>
              </div>
              <p className="text-2xl font-bold text-white">{kpi.value}</p>
              <p className="text-xs text-gray-400 mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Total Energy Production — Last 14 Days</h3>
            <ProductionBarChart data={monthlyChart} height={240} color="#f59e0b" />
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Energy by Installation</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={energyMix} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                  {energyMix.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', fontSize: '12px' }} formatter={(value) => [`${value ?? 0} kWh`, 'Production']} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Daily Power Curve (Today)</h3>
            <PowerChart data={hourlyData} height={220} />
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Installation Performance Ratio</h3>
            <ResponsiveContainer width="100%" height={220}>
              <RadialBarChart cx="50%" cy="50%" innerRadius={30} outerRadius={90} data={instPerformance}>
                <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#1f2937' }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', fontSize: '12px' }} formatter={(value) => [`${value ?? 0}%`, 'Performance']} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
            <Building2 className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Installation Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs text-gray-500 px-5 py-3">Installation</th>
                  <th className="text-right text-xs text-gray-500 px-5 py-3">Capacity</th>
                  <th className="text-right text-xs text-gray-500 px-5 py-3">Monthly</th>
                  <th className="text-right text-xs text-gray-500 px-5 py-3">Perf. Ratio</th>
                  <th className="text-right text-xs text-gray-500 px-5 py-3">CO₂</th>
                  <th className="text-right text-xs text-gray-500 px-5 py-3">Revenue Est.</th>
                </tr>
              </thead>
              <tbody>
                {installations.slice(0, 3).map((inst, index) => {
                  const perf = [97, 88, 73][index] ?? 82;
                  const monthly = Math.max(100, Math.round((inst.capacity_kw ?? 1) * 110));
                  const co2 = Math.round(monthly * 0.49);
                  const rev = Math.round(monthly * 0.15);
                  return (
                    <tr key={inst.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-4 text-sm font-medium text-white">{inst.name}</td>
                      <td className="px-5 py-4 text-right text-xs text-gray-300">{inst.capacity_kw} kWp</td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-amber-400">{monthly} kWh</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${perf}%` }} />
                          </div>
                          <span className="text-xs text-gray-300">{perf}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right text-xs text-emerald-400">{co2} kg</td>
                      <td className="px-5 py-4 text-right text-xs font-semibold text-blue-400">${rev}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-800/30">
                  <td className="px-5 py-3 text-xs font-semibold text-gray-300">Total</td>
                  <td className="px-5 py-3 text-right text-xs font-semibold text-gray-300">{installations.reduce((sum, inst) => sum + (inst.capacity_kw ?? 0), 0).toFixed(1)} kWp</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-amber-400">{totalEnergy.toFixed(0)} kWh</td>
                  <td className="px-5 py-3 text-right text-xs text-gray-400">—</td>
                  <td className="px-5 py-3 text-right text-xs font-semibold text-emerald-400">{Math.round(totalEnergy * 0.49)} kg</td>
                  <td className="px-5 py-3 text-right text-xs font-bold text-blue-400">${Math.round(totalEnergy * 0.15)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            { title: 'User Growth', metric: '+2 this month', sub: '5 total customers', icon: Users, color: 'text-blue-400' },
            { title: 'Avg Daily Production', metric: `${(totalEnergy / 14).toFixed(1)} kWh`, sub: 'All installations', icon: Sun, color: 'text-amber-400' },
            { title: 'System Availability', metric: '99.1%', sub: 'Last 30 days', icon: TrendingUp, color: 'text-emerald-400' },
          ].map(item => (
            <div key={item.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
                <item.icon className={`w-6 h-6 ${item.color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{item.title}</p>
                <p className="text-xl font-bold text-white mt-0.5">{item.metric}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
