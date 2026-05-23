import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Zap, Thermometer, Sun, Activity, Battery, Wind, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatCard from '../../components/ui/StatCard';
import PowerChart from '../../components/charts/PowerChart';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getLiveTelemetry, getLastUpdateTime, getHistoricalTelemetry } from '../../services/telemetry';
import type { Installation } from '../../lib/database.types';
import type { TelemetryData } from '../../services/telemetry';

function GaugeCard({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference * 0.75;
  const rotation = -135;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col items-center hover:border-gray-700 transition-all">
      <svg width="100" height="70" viewBox="0 0 100 70" className="overflow-visible mb-1">
        <circle cx="50" cy="55" r={radius} fill="none" stroke="#1f2937" strokeWidth="8"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeDashoffset={0}
          transform={`rotate(${rotation} 50 55)`}
          strokeLinecap="round"
        />
        <circle cx="50" cy="55" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(${rotation} 50 55)`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 4px ${color}80)` }}
        />
        <text x="50" y="52" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
          {value.toFixed(1)}
        </text>
        <text x="50" y="64" textAnchor="middle" fill="#6b7280" fontSize="8">
          {unit}
        </text>
      </svg>
      <p className="text-xs text-gray-400 font-medium text-center">{label}</p>
    </div>
  );
}



export default function UserDashboard() {
  const { profile } = useAuth();
  const [installations, setInstallations] = useState<Installation[]>([]);

  const installation = installations[0] ?? null;
  const deviceId = installation?.device_id ?? '';

  // Fetch user's installations from Supabase
  useEffect(() => {
    async function loadInstallations() {
      if (!profile?.id) return;
      try {
        // Direct Supabase query to get installations with device_id
        const { data, error } = await supabase
          .from('installations')
          .select('*')
          .eq('owner_id', profile.id)
          .limit(1);
        
        if (error) throw error;
        setInstallations((data as Installation[]) ?? []);
      } catch (err) {
        console.error('Failed to load installations', err);
      }
    }
    loadInstallations();
  }, [profile?.id]);

  // Fetch real telemetry from Node-RED API using device_id
  const { data: telemetry, isLoading: telemetryLoading, isError: telemetryError } = useQuery<TelemetryData | null>({
    queryKey: ['telemetry', deviceId],
    queryFn: () => (deviceId ? getLiveTelemetry(deviceId) : Promise.resolve(null)),
    enabled: !!deviceId,
    staleTime: 2000,
    refetchInterval: 5000,
    retry: 1,
  });

  const isOnline = telemetry?.connected ?? false;

  const [historyData, setHistoryData] = useState<{ time: string; power: number; irradiance: number }[]>([]);

  // Load initial historical data from InfluxDB on mount/device link
  useEffect(() => {
    async function loadInitialHistory() {
      if (!deviceId) return;
      try {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const data = await getHistoricalTelemetry(deviceId, oneHourAgo.toISOString(), now.toISOString());
        if (data && data.length > 0) {
          const mapped = data.map(item => {
            const rawPower = item.power ?? (item.voltage && item.current ? (item.voltage * item.current) / 1000 : 0);
            // Ensure power is in kW (if it's in Watts (> 50), convert to kW)
            const power_kw = rawPower > 50 ? rawPower / 1000 : rawPower;
            return {
              time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              power: parseFloat(power_kw.toFixed(2)),
              irradiance: item.irradiance ?? 0
            };
          });
          setHistoryData(mapped.slice(-15));
        }
      } catch (err) {
        console.error('Failed to load initial history', err);
      }
    }
    loadInitialHistory();
  }, [deviceId]);

  // Append new live telemetry reading to history
  useEffect(() => {
    if (!telemetry) return;

    const timeStr = new Date(telemetry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setHistoryData(prev => {
      // Avoid duplicate timestamps
      if (prev.length > 0 && prev[prev.length - 1].time === timeStr) {
        return prev;
      }

      const newPoint = {
        time: timeStr,
        power: telemetry.power ?? 0,
        irradiance: telemetry.irradiance ?? 0,
      };

      const updated = [...prev, newPoint];
      // Keep only last 15 points
      if (updated.length > 15) {
        return updated.slice(updated.length - 15);
      }
      return updated;
    });
  }, [telemetry]);

  return (
    <AppLayout title="Dashboard">
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">{installation ? installation.name : 'My Solar System'}</h2>
            <p className="text-sm text-gray-400 mt-0.5">{installation ? installation.address : 'Loading your installation data...'}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${isOnline ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isOnline ? 'Online' : 'Offline'}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <RefreshCw className="w-3.5 h-3.5" style={{ animation: telemetryLoading ? 'spin 1s linear infinite' : 'none' }} />
              {telemetry ? `Updated ${getLastUpdateTime(telemetry.timestamp)}` : 'Waiting for data...'}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Live Readings</h3>
          {!deviceId || telemetryError ? (
            <div className="rounded-2xl border border-dashed border-gray-700 p-8 text-center text-sm text-gray-400">
              {!deviceId ? 'No device linked to this installation.' : 'Unable to connect to telemetry server.'}
            </div>
          ) : telemetryLoading && !telemetry ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-800 bg-gray-950 p-8">
              <LoadingSpinner size="sm" />
              <span className="text-sm text-gray-400">Loading telemetry data...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <GaugeCard label="Voltage" value={telemetry?.voltage ?? 0} max={500} unit="V" color="#f59e0b" />
              <GaugeCard label="Current" value={telemetry?.current ?? 0} max={30} unit="A" color="#06b6d4" />
              <GaugeCard label="Power" value={(telemetry?.power ?? 0)} max={15} unit="kW" color="#10b981" />
              <GaugeCard label="Temperature" value={telemetry?.temperature ?? 0} max={80} unit="°C" color="#ef4444" />
              <GaugeCard label="Irradiance" value={telemetry?.irradiance ?? 0} max={1200} unit="W/m²" color="#f59e0b" />
              <GaugeCard label="Energy Today" value={(telemetry?.power ?? 0) * 0.08} max={50} unit="kWh" color="#8b5cf6" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Current Power"
            value={telemetry ? (telemetry.power ?? 0).toFixed(2) : '—'}
            unit="kW"
            icon={<Zap className="w-5 h-5" />}
            color="amber"
            glowing={isOnline}
          />
          <StatCard
            label="Today's Energy"
            value={telemetry ? ((telemetry.power ?? 0) * 0.08).toFixed(1) : '—'}
            unit="kWh"
            icon={<Battery className="w-5 h-5" />}
            color="emerald"
          />
          <StatCard
            label="Panel Temperature"
            value={telemetry ? (telemetry.temperature ?? 0).toFixed(1) : '—'}
            unit="°C"
            icon={<Thermometer className="w-5 h-5" />}
            color="rose"
            subtitle="Optimal range: 20–50°C"
          />
          <StatCard
            label="Irradiance"
            value={telemetry ? (telemetry.irradiance ?? 0).toFixed(0) : '—'}
            unit="W/m²"
            icon={<Sun className="w-5 h-5" />}
            color="cyan"
            subtitle="Solar energy input"
          />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Power Output — Real-Time History</h3>
              <p className="text-xs text-gray-500 mt-0.5">Live-updating telemetry history (every 5 seconds)</p>
            </div>
            <Badge variant="success" dot>Live</Badge>
          </div>
          <PowerChart data={historyData.length > 0 ? historyData : [{ time: '00:00', power: 0, irradiance: 0 }]} height={220} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">System Overview</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {(installation ? [
                { label: 'Capacity', value: `${installation.capacity_kw} kWp`, icon: <Activity className="w-4 h-4 text-amber-400" /> },
                { label: 'Panels', value: `${installation.panel_count} units`, icon: <Sun className="w-4 h-4 text-amber-400" /> },
                { label: 'Inverter', value: installation.inverter_model, icon: <Zap className="w-4 h-4 text-blue-400" /> },
                { label: 'Status', value: installation.status, icon: <Wifi className="w-4 h-4 text-emerald-400" /> },
                { label: 'Installed', value: installation.installation_date ?? 'N/A', icon: <Activity className="w-4 h-4 text-gray-400" /> },
                { label: 'Performance', value: '97.2%', icon: <Wind className="w-4 h-4 text-cyan-400" /> },
              ] : [
                { label: 'Capacity', value: '—', icon: <Activity className="w-4 h-4 text-amber-400" /> },
                { label: 'Panels', value: '—', icon: <Sun className="w-4 h-4 text-amber-400" /> },
                { label: 'Inverter', value: '—', icon: <Zap className="w-4 h-4 text-blue-400" /> },
                { label: 'Status', value: '—', icon: <Wifi className="w-4 h-4 text-emerald-400" /> },
                { label: 'Installed', value: '—', icon: <Activity className="w-4 h-4 text-gray-400" /> },
                { label: 'Performance', value: '—', icon: <Wind className="w-4 h-4 text-cyan-400" /> },
              ]).map(item => (
                <div key={item.label} className="bg-gray-800/40 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">{item.icon}<p className="text-xs text-gray-500">{item.label}</p></div>
                  <p className="text-sm font-semibold text-white capitalize">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Live Metrics</h3>
            <div className="space-y-3">
              {[
                { label: 'Device Status', value: telemetry?.connected ? 'Connected' : 'Disconnected', color: telemetry?.connected ? 'text-emerald-400' : 'text-red-400' },
                { label: 'Current Power', value: telemetry ? `${(telemetry.power ?? 0).toFixed(2)} kW` : '—', color: 'text-amber-400' },
                { label: 'Voltage', value: telemetry ? `${(telemetry.voltage ?? 0).toFixed(1)} V` : '—', color: 'text-blue-400' },
                { label: 'Current', value: telemetry ? `${(telemetry.current ?? 0).toFixed(2)} A` : '—', color: 'text-cyan-400' },
                { label: 'Panel Temp', value: telemetry ? `${(telemetry.temperature ?? 0).toFixed(1)}°C` : '—', color: 'text-amber-300' },
                { label: 'Solar Irradiance', value: telemetry ? `${(telemetry.irradiance ?? 0).toFixed(0)} W/m²` : '—', color: 'text-yellow-300' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{item.label}</span>
                  <span className={`text-xs font-semibold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
