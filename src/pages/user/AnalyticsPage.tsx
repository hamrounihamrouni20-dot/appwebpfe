import { useEffect, useMemo, useState } from 'react';
import { Download, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import ProductionBarChart from '../../components/charts/ProductionBarChart';
import { useAuth } from '../../contexts/AuthContext';
import { getInstallationsByUser } from '../../lib/api';
import { getHistoricalTelemetry } from '../../services/telemetry';
import type { Installation, PvData } from '../../lib/database.types';

type Period = 'daily' | 'weekly' | 'monthly';
type DateFilter = 'custom' | 'today' | 'week' | 'month' | 'year';

function MetricCard({ label, value, unit, change, positive }: { label: string; value: string; unit: string; change: string; positive: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value} <span className="text-sm text-gray-500 font-normal">{unit}</span></p>
      <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
        {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        {change}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { profile } = useAuth();
  const [period, setPeriod] = useState<Period>('daily');
  const [pvData, setPvData] = useState<PvData[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [installationId, setInstallationId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activeFilter, setActiveFilter] = useState<DateFilter>('custom');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedInstallation = useMemo(
    () => installations.find(install => install.id === installationId) ?? null,
    [installations, installationId],
  );

  const buildDateString = (date: Date) => date.toISOString().slice(0, 10);

  const getRangeDates = (filter: DateFilter) => {
    const now = new Date();
    const end = buildDateString(now);
    let start = end;

    if (filter === 'week') {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      start = buildDateString(weekStart);
    }
    if (filter === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      start = buildDateString(monthStart);
    }
    if (filter === 'year') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      start = buildDateString(yearStart);
    }
    return { start, end };
  };

  const loadAnalytics = async (installationIdToUse?: string, startOverride?: string, endOverride?: string) => {
    if (!profile?.id) return;
    setError(null);
    setIsLoading(true);
    try {
      const availableInstallations = await getInstallationsByUser(profile.id);
      const installs = availableInstallations || [];
      setInstallations(installs);
      const activeInstallationId = installationIdToUse ?? installationId ?? installs[0]?.id;
      if (!activeInstallationId) {
        setInstallationId(null);
        setPvData([]);
        return;
      }
      setInstallationId(activeInstallationId);
      
      const activeInstallation = installs.find(install => install.id === activeInstallationId);
      const deviceId = activeInstallation?.device_id || 'ESP32_001';

      const start = startOverride ?? startDate;
      const end = endOverride ?? endDate;
      const startIso = new Date(`${start}T00:00:00`).toISOString();
      const endIso = new Date(`${end}T23:59:59.999`).toISOString();
      
      const history = await getHistoricalTelemetry(deviceId, startIso, endIso);
      
      // Calculate energy_kwh and convert types appropriately
      let prevTime: string | null = null;
      let prevPower = 0;
      
      const mappedHistory: PvData[] = history.map((item) => {
        // Map raw power to power_w (Watts). If power is in kW (e.g. 5.2 kW), convert to Watts (5200W).
        const rawPower = item.power ?? (item.voltage && item.current ? (item.voltage * item.current) / 1000 : 0);
        const power_w = rawPower < 50 ? rawPower * 1000 : rawPower;
        
        let energy_kwh = 0;
        if (prevTime !== null) {
          const diffMs = new Date(item.timestamp).getTime() - new Date(prevTime).getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          const avgPower = (prevPower + power_w) / 2;
          energy_kwh = (avgPower * diffHours) / 1000;
        }
        
        prevTime = item.timestamp;
        prevPower = power_w;
        
        return {
          id: Math.random().toString(36).substring(7),
          installation_id: activeInstallationId,
          sensor_id: null,
          timestamp: item.timestamp,
          voltage: item.voltage,
          current_a: item.current,
          power_w: power_w,
          temperature_c: item.temperature,
          irradiance_wm2: item.irradiance,
          energy_kwh: energy_kwh,
          created_at: item.timestamp
        };
      });
      
      setPvData(mappedHistory);
    } catch (loadError) {
      console.error('Failed to load analytics data', loadError);
      setPvData([]);
      setError('Unable to load analytics data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const applyDateFilter = async (filter: DateFilter) => {
    const { start, end } = getRangeDates(filter);
    setActiveFilter(filter);
    setStartDate(start);
    setEndDate(end);
    await loadAnalytics(installationId ?? undefined, start, end);
  };

  useEffect(() => {
    loadAnalytics();
  }, [profile?.id]);

  const stats = useMemo(() => {
    const data = pvData.filter(entry => entry.energy_kwh != null || entry.power_w != null || entry.voltage != null || entry.temperature_c != null || entry.irradiance_wm2 != null);
    const totalEnergy = pvData.reduce((sum, entry) => sum + (entry.energy_kwh ?? 0), 0);
    const totalPower = pvData.reduce((sum, entry) => sum + (entry.power_w ?? 0), 0);
    const validPowerCount = pvData.filter(entry => entry.power_w != null).length;
    const maxPower = pvData.reduce((max, entry) => Math.max(max, entry.power_w ?? 0), 0);
    const avgPower = validPowerCount > 0 ? totalPower / validPowerCount : 0;
    const validTemp = pvData.map(entry => entry.temperature_c).filter((value): value is number => value != null && !Number.isNaN(value));
    const validIrr = pvData.map(entry => entry.irradiance_wm2).filter((value): value is number => value != null && !Number.isNaN(value));
    const avgTemp = validTemp.length ? validTemp.reduce((sum, v) => sum + v, 0) / validTemp.length : 0;
    const avgIrr = validIrr.length ? validIrr.reduce((sum, v) => sum + v, 0) / validIrr.length : 0;
    const minEnergy = pvData.reduce((min, entry) => {
      const value = entry.energy_kwh;
      if (value == null) return min;
      return min === null ? value : Math.min(min, value);
    }, null as number | null);
    const maxEnergy = pvData.reduce((max, entry) => {
      const value = entry.energy_kwh;
      if (value == null) return max;
      return Math.max(max ?? value, value);
    }, null as number | null);
    const uniqueDayCount = new Set(pvData.map(entry => entry.timestamp ? new Date(entry.timestamp).toISOString().slice(0, 10) : '')).size;
    const avgEnergyDay = uniqueDayCount > 0 ? totalEnergy / uniqueDayCount : 0;

    return {
      totalEnergy,
      avgPower,
      peakPower: maxPower,
      avgTemperature: avgTemp,
      avgIrradiance: avgIrr,
      minEnergy: minEnergy ?? 0,
      maxEnergy: maxEnergy ?? 0,
      avgEnergyDay,
      uniqueDayCount,
      dataCount: data.length,
    };
  }, [pvData]);

  const dailyData = useMemo(() => {
    const summary = pvData.reduce<Record<string, { kwh: number; peak_kwh: number }>>((acc, entry) => {
      const timestamp = entry.timestamp ? new Date(entry.timestamp) : null;
      if (!timestamp) return acc;
      const dateKey = timestamp.toISOString().slice(0, 10);
      const energy = entry.energy_kwh ?? 0;
      const peak = (entry.power_w ?? 0) / 1000;
      const existing = acc[dateKey] ?? { kwh: 0, peak_kwh: 0 };
      acc[dateKey] = {
        kwh: existing.kwh + energy,
        peak_kwh: Math.max(existing.peak_kwh, peak),
      };
      return acc;
    }, {});

    return Object.entries(summary)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, values]) => ({
        label: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        kwh: parseFloat(values.kwh.toFixed(1)),
        peak_kwh: parseFloat(values.peak_kwh.toFixed(1)),
        date,
      }));
  }, [pvData]);

  const chartData = useMemo(() => {
    if (period === 'daily') return dailyData.slice(-14).map(({ label, kwh }) => ({ label, kwh }));
    if (period === 'weekly') {
      return dailyData.reduce<{ label: string; kwh: number }[]>((acc, row, idx) => {
        const weekIndex = Math.floor(idx / 7);
        const label = `W${weekIndex + 1}`;
        const existing = acc[weekIndex];
        if (existing) {
          existing.kwh += row.kwh;
        } else {
          acc[weekIndex] = { label, kwh: row.kwh };
        }
        return acc;
      }, []).reverse();
    }
    return dailyData.slice(-6).map(row => ({ label: new Date(row.date).toLocaleDateString('en', { month: 'short' }), kwh: row.kwh }));
  }, [dailyData, period]);

  const totalKwh = chartData.reduce((s, d) => s + d.kwh, 0);



  const exportCSV = () => {
    const headers = ['timestamp', 'voltage', 'current', 'power', 'temperature', 'irradiance', 'energy_kwh', 'installation_name'];
    const rows = [
      headers,
      ...pvData.map(entry => [
        entry.timestamp ? entry.timestamp : '',
        entry.voltage != null ? entry.voltage.toString() : '',
        entry.current_a != null ? entry.current_a.toString() : '',
        entry.power_w != null ? entry.power_w.toString() : '',
        entry.temperature_c != null ? entry.temperature_c.toString() : '',
        entry.irradiance_wm2 != null ? entry.irradiance_wm2.toString() : '',
        entry.energy_kwh != null ? entry.energy_kwh.toString() : '',
        selectedInstallation?.name ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solarwatch-analytics-${selectedInstallation?.name ?? 'installation'}-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout title="Analytics">
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Production Analytics</h2>
            <p className="text-sm text-gray-400 mt-0.5">Historical energy generation data</p>
          </div>
          <button
            onClick={exportCSV}
            disabled={isLoading || pvData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="grid gap-4">
              <div className="grid gap-3 lg:grid-cols-[auto_1fr] items-end">
                <div className="grid gap-2">
                  <span className="text-xs text-gray-400 uppercase tracking-[.18em]">Installation</span>
                  <select
                    value={installationId ?? ''}
                    onChange={async e => {
                      const value = e.target.value;
                      setInstallationId(value);
                      await loadAnalytics(value, startDate, endDate);
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {installations.map(install => (
                      <option key={install.id} value={install.id}>{install.name || install.address || install.id}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {(['today', 'week', 'month', 'year'] as DateFilter[]).map(filter => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => applyDateFilter(filter)}
                      className={`px-3 py-2 rounded-2xl text-xs font-medium transition-all ${activeFilter === filter ? 'bg-amber-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                    >
                      {filter === 'today' ? 'Today' : filter === 'week' ? 'This Week' : filter === 'month' ? 'This Month' : 'This Year'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setActiveFilter('custom')}
                    className={`px-3 py-2 rounded-2xl text-xs font-medium transition-all ${activeFilter === 'custom' ? 'bg-amber-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="text-xs text-gray-400 flex flex-col gap-1">
                  <span>Start Date</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => {
                      setStartDate(e.target.value);
                      setActiveFilter('custom');
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </label>
                <label className="text-xs text-gray-400 flex flex-col gap-1">
                  <span>End Date</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => {
                      setEndDate(e.target.value);
                      setActiveFilter('custom');
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </label>
                <div className="sm:col-span-2 flex items-end">
                  <button
                    onClick={() => loadAnalytics(installationId ?? undefined)}
                    disabled={isLoading || !installationId}
                    className="w-full px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Loading...' : 'Apply Range'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Total energy" value={`${stats.totalEnergy.toFixed(1)}`} unit="kWh" change={`${stats.dataCount} records`} positive={stats.totalEnergy >= 0} />
            <MetricCard label="Avg energy / day" value={`${stats.avgEnergyDay.toFixed(1)}`} unit="kWh" change={`${stats.uniqueDayCount} days`} positive={stats.avgEnergyDay >= 0} />
            <MetricCard label="Peak power" value={`${stats.peakPower.toFixed(0)}`} unit="W" change="max recorded" positive={true} />
            <MetricCard label="Avg temperature" value={`${stats.avgTemperature.toFixed(1)}`} unit="°C" change="from range" positive={true} />
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-300">Loading telemetry data...</div>
        ) : pvData.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-300">No telemetry data available for the selected installation and date range.</div>
        ) : null}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-sm font-semibold text-white">Energy Production</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Total: <span className="text-amber-400 font-semibold">{totalKwh.toFixed(1)} kWh</span>
              </p>
            </div>
            <div className="flex gap-1 bg-gray-800 p-1 rounded-xl">
              {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${period === p ? 'bg-amber-500 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <ProductionBarChart data={chartData} height={260} />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Daily Production Log</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Date</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Production</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Peak Power</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">vs. Target</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">CO₂ Saved</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.slice(-10).reverse().map(day => {
                  const target = 30;
                  const pct = day.kwh / target * 100;
                  const isAbove = pct >= 100;
                  return (
                    <tr key={day.date} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-3 text-sm text-white">
                        {new Date(day.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-semibold text-amber-400">{day.kwh.toFixed(1)} kWh</td>
                      <td className="px-5 py-3 text-sm text-right text-gray-300">{day.peak_kwh.toFixed(1)} kW</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`text-xs font-semibold ${isAbove ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isAbove ? '+' : ''}{(pct - 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-right text-gray-400">{(day.kwh * 0.489).toFixed(1)} kg</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
