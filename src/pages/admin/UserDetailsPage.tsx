import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mail, Phone, Zap, Thermometer, Sun, Battery, TrendingUp } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import Badge from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
import PowerChart from '../../components/charts/PowerChart';
import { getUserDetails } from '../../services/users';
import { getInstallationHistory, getInstallationLiveOverview } from '../../services/monitoring';
import { getLiveTelemetry, getTelemetryStatus, getLastUpdateTime } from '../../services/telemetry';
import type { TelemetryData } from '../../services/telemetry';

function summaryStatus(live: any) {
  if (!live) return { label: 'Unknown', variant: 'neutral' };
  if (live.power_w === null || live.power_w === undefined) return { label: 'No data', variant: 'warning' };
  if (live.power_w <= 50) return { label: 'Critical', variant: 'error' };
  if (live.power_w <= 300) return { label: 'Warning', variant: 'warning' };
  return { label: 'Healthy', variant: 'success' };
}

function formatDate(value?: string) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
}

export default function UserDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedInstallationId, setSelectedInstallationId] = useState<string | null>(null);

  type UserDetails = {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    role: string;
    is_active: boolean;
    created_at: string;
    installations_count: number;
    tickets_count: number;
    created_tickets_count: number;
    assigned_tickets_count: number;
    installations?: Array<any>;
    tickets?: Array<any>;
  };

  const { data: user, isLoading: userLoading, isError: userError } = useQuery<UserDetails>({
    queryKey: ['admin-user', id],
    queryFn: () => getUserDetails(id ?? ''),
    enabled: !!id,
    staleTime: 15000,
    refetchInterval: 20000,
    retry: 1,
  });

  useEffect(() => {
    if (!selectedInstallationId && user?.installations?.length) {
      setSelectedInstallationId(user.installations[0].id);
    }
  }, [user, selectedInstallationId]);

  const { data: liveOverview, isLoading: liveLoading } = useQuery({
    queryKey: ['installation-live', selectedInstallationId],
    queryFn: () => getInstallationLiveOverview(selectedInstallationId ?? ''),
    enabled: !!selectedInstallationId,
    staleTime: 10000,
    refetchInterval: 15000,
    retry: 1,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['installation-history', selectedInstallationId],
    queryFn: () => getInstallationHistory(selectedInstallationId ?? '', 24),
    enabled: !!selectedInstallationId,
    staleTime: 10000,
    retry: 1,
  });

  const selectedInstallation = useMemo(
    () => user?.installations?.find((inst: any) => inst.id === selectedInstallationId) ?? null,
    [user, selectedInstallationId]
  );

  // Fetch real telemetry data from Node-RED API using device_id
  const { data: telemetry, isLoading: telemetryLoading, isError: telemetryError } = useQuery<TelemetryData | null>({
    queryKey: ['telemetry', selectedInstallation?.device_id],
    queryFn: () => getLiveTelemetry(selectedInstallation?.device_id ?? ''),
    enabled: !!selectedInstallation?.device_id,
    staleTime: 2000,
    refetchInterval: 5000,
    retry: 1,
  });

  const recentChartData = useMemo(() => {
    if (!history || history.length === 0) return [{ time: '00:00', power: 0 }];
    return [...history]
      .reverse()
      .map(record => ({
        time: new Date(record.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
        power: record.power_w ?? 0,
        irradiance: record.irradiance_wm2 ?? 0,
      }));
  }, [history]);

  const live = telemetry || liveOverview?.live;
  const sensors = liveOverview?.sensors ?? [];
  const telemetryStatus = telemetry ? getTelemetryStatus(telemetry.connected) : { label: 'No live feed', variant: 'warning' as const };
  const health = summaryStatus(live);

  return (
    <AppLayout title={user ? `${user.full_name} — User Details` : 'User Details'}>
      <div className="p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to users
            </button>
            <div>
              <h2 className="text-xl font-bold text-white">{user?.full_name ?? 'User detail'}</h2>
              <p className="text-sm text-gray-400">Account and installation monitoring for this customer.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={health.variant as any} dot>{health.label}</Badge>
            <Badge variant="success" dot>{user?.role ?? 'user'}</Badge>
            <Badge variant={user?.is_active ? 'success' : 'neutral'} dot>{user?.is_active ? 'Active' : 'Inactive'}</Badge>
          </div>
        </div>

        {userError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">Unable to load user details. Please refresh or try again.</div>
        )}

        {userLoading ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">Loading user profile…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-6 min-h-[420px]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 border border-amber-500/20 text-2xl font-semibold text-amber-300">
                      {user?.full_name?.charAt(0) ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-500">User Overview</p>
                      <h3 className="mt-2 text-3xl font-semibold text-white leading-tight break-words">{user?.full_name}</h3>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant={user?.role === 'admin' ? 'error' : user?.role === 'technician' ? 'info' : 'success'}>{user?.role ?? 'user'}</Badge>
                        <Badge variant={user?.is_active ? 'success' : 'neutral'}>{user?.is_active ? 'Active' : 'Inactive'}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-gray-800 bg-gray-950/40 px-4 py-3 text-sm text-gray-400">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Member since</p>
                    <p className="mt-2 text-white">{formatDate(user?.created_at)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="bg-gray-800/70 border border-gray-800 rounded-3xl p-5 min-h-[145px] min-w-0">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3">Email</p>
                    <div className="flex items-start gap-3 min-w-0">
                      <Mail className="w-5 h-5 text-amber-400 flex-shrink-0 mt-1" />
                      <p className="text-sm text-white min-w-0 break-words leading-6">{user?.email ?? 'No email available'}</p>
                    </div>
                  </div>

                  <div className="bg-gray-800/70 border border-gray-800 rounded-3xl p-5 min-h-[145px] min-w-0">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3">Phone</p>
                    <div className="flex items-start gap-3 min-w-0">
                      <Phone className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                      <p className="text-sm text-white min-w-0 break-words leading-6">{user?.phone || 'No phone number'}</p>
                    </div>
                  </div>

                  <div className="bg-gray-800/70 border border-gray-800 rounded-3xl p-5 min-h-[145px]">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3">Installations</p>
                    <p className="text-4xl font-semibold text-white">{user?.installations_count ?? 0}</p>
                  </div>

                  <div className="bg-gray-800/70 border border-gray-800 rounded-3xl p-5 min-h-[145px]">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3">Tickets</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-400">Created</p>
                        <p className="mt-2 text-lg font-semibold text-white">{user?.created_tickets_count ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Assigned</p>
                        <p className="mt-2 text-lg font-semibold text-white">{user?.assigned_tickets_count ?? 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-800 pt-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <button type="button" className="rounded-2xl border border-gray-800 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-gray-700 hover:bg-white/10">View Installations</button>
                    <button type="button" className="rounded-2xl border border-gray-800 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-gray-700 hover:bg-white/10">View Tickets</button>
                    <button type="button" className="rounded-2xl border border-gray-800 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-gray-700 hover:bg-white/10">Contact User</button>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Installation inventory</p>
                    <h3 className="text-lg font-semibold text-white mt-2">Owned Systems</h3>
                  </div>
                </div>
                {!user?.installations?.length ? (
                  <div className="rounded-3xl border border-dashed border-gray-700 p-6 text-center text-sm text-gray-400">
                    No installations are linked to this user.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {user.installations.map((installation: any) => (
                      <button
                        key={installation.id}
                        type="button"
                        onClick={() => setSelectedInstallationId(installation.id)}
                        className={`w-full text-left rounded-3xl border px-5 py-4 transition-all ${selectedInstallationId === installation.id ? 'border-amber-500/40 bg-amber-500/10' : 'border-gray-800 bg-gray-900 hover:border-gray-700'}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-white">{installation.name}</p>
                            <p className="text-xs text-gray-500 mt-1">{installation.address}</p>
                          </div>
                          <Badge variant={installation.status === 'active' ? 'success' : installation.status === 'maintenance' ? 'warning' : installation.status === 'fault' ? 'error' : 'neutral'}>{installation.status}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-4 text-xs text-gray-400">
                          <div className="space-y-1">
                            <p>Inverter</p>
                            <p className="text-white">{installation.inverter_model || 'N/A'}</p>
                          </div>
                          <div className="space-y-1">
                            <p>Capacity</p>
                            <p className="text-white">{installation.capacity_kw ?? 0} kWp</p>
                          </div>
                          <div className="space-y-1">
                            <p>Panels</p>
                            <p className="text-white">{installation.panel_count ?? 0}</p>
                          </div>
                          <div className="space-y-1">
                            <p>Installed</p>
                            <p className="text-white">{installation.installation_date ? new Date(installation.installation_date).toLocaleDateString() : 'N/A'}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Live PV monitoring</p>
                    <h3 className="text-lg font-semibold text-white mt-2">{selectedInstallation?.name ?? 'Select an installation'}</h3>
                    {selectedInstallation?.device_id && (
                      <p className="text-xs text-gray-500 mt-1">Device: {selectedInstallation.device_id}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={health.variant as any} dot>{health.label}</Badge>
                    <Badge variant={telemetryStatus.variant} dot>{telemetryStatus.label}</Badge>
                    {!selectedInstallation?.device_id && (
                      <Badge variant="warning">No device linked</Badge>
                    )}
                  </div>
                </div>

                {!selectedInstallation?.device_id ? (
                  <div className="rounded-2xl border border-dashed border-gray-700 p-6 text-center text-sm text-gray-400">
                    No device ID linked to this installation. Telemetry data unavailable.
                  </div>
                ) : telemetryLoading ? (
                  <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6 text-center text-sm text-gray-400">
                    Loading telemetry data…
                  </div>
                ) : telemetryError || !telemetry ? (
                  <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6 text-center text-sm text-amber-400">
                    Unable to connect to telemetry server. {selectedInstallation?.device_id && `Device: ${selectedInstallation.device_id}`}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                      <StatCard label="Voltage" value={telemetry.voltage != null ? `${telemetry.voltage.toFixed(2)}` : 'No data'} unit="V" icon={<Zap className="w-5 h-5" />} color="amber" />
                      <StatCard label="Current" value={telemetry.current != null ? `${telemetry.current.toFixed(2)}` : 'No data'} unit="A" icon={<Battery className="w-5 h-5" />} color="cyan" />
                      <StatCard label="Power" value={telemetry.power != null ? `${(telemetry.power).toFixed(2)}` : 'No data'} unit="kW" icon={<Zap className="w-5 h-5" />} color="emerald" />
                      <StatCard label="Last Update" value={getLastUpdateTime(telemetry.timestamp)} unit="" icon={<TrendingUp className="w-5 h-5" />} color="blue" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <StatCard label="Temperature" value={telemetry.temperature != null ? `${telemetry.temperature.toFixed(1)}` : 'No data'} unit="°C" icon={<Thermometer className="w-5 h-5" />} color="rose" />
                      <StatCard label="Irradiance" value={telemetry.irradiance != null ? `${telemetry.irradiance.toFixed(0)}` : 'No data'} unit="W/m²" icon={<Sun className="w-5 h-5" />} color="cyan" />
                    </div>
                  </>
                )}
                <div className="mt-6 bg-gray-950 border border-gray-800 rounded-3xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Performance trend</p>
                      <p className="text-sm text-gray-300 mt-1">Recent output and irradiance curve</p>
                    </div>
                    <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                      <TrendingUp className="w-4 h-4" />
                      Updated every 5s
                    </div>
                  </div>
                  <PowerChart data={recentChartData} height={280} />
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Sensor health</p>
                    <h3 className="text-lg font-semibold text-white">Device telemetry</h3>
                  </div>
                  <div className="text-xs text-gray-400">{sensors.length} sensors attached</div>
                </div>
                {!sensors.length ? (
                  <div className="rounded-3xl border border-dashed border-gray-700 p-6 text-center text-sm text-gray-400">No sensors assigned to this installation.</div>
                ) : (
                  <div className="grid gap-3">
                    {sensors.map(sensor => (
                      <div key={sensor.id} className="rounded-3xl border border-gray-800 p-4 bg-gray-950">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{sensor.name}</p>
                            <p className="text-xs text-gray-500">{sensor.sensor_type} • {sensor.device_id}</p>
                          </div>
                          <Badge variant={sensor.is_online ? 'success' : 'error'} dot>
                            {sensor.is_online ? 'Online' : 'Offline'}
                          </Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-gray-400">
                          <div>
                            <p>Last seen</p>
                            <p className="text-white">{formatDate(sensor.last_seen)}</p>
                          </div>
                          <div>
                            <p>Sensor ID</p>
                            <p className="text-white truncate">{sensor.id}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
