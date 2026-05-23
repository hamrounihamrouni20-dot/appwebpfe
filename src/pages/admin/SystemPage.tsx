import { ShieldCheck, Database, Wifi, Server, Activity, RefreshCw } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import Badge from '../../components/ui/Badge';

const SERVICES = [
  { name: 'Database', status: 'online', latency: '4ms', icon: Database, color: 'text-emerald-400' },
  { name: 'MQTT Broker', status: 'online', latency: '12ms', icon: Wifi, color: 'text-emerald-400' },
  { name: 'API Server', status: 'online', latency: '8ms', icon: Server, color: 'text-emerald-400' },
  { name: 'AI Model', status: 'online', latency: '250ms', icon: Activity, color: 'text-emerald-400' },
  { name: 'InfluxDB', status: 'config', latency: '—', icon: Database, color: 'text-amber-400' },
  { name: 'Grafana', status: 'config', latency: '—', icon: Activity, color: 'text-amber-400' },
];

export default function SystemPage() {
  return (
    <AppLayout title="System">
      <div className="p-6 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">System Status</h2>
            <p className="text-sm text-gray-400 mt-0.5">Infrastructure health and configuration</p>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Overall status */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-400">All Systems Operational</p>
            <p className="text-xs text-emerald-400/60 mt-0.5">Last checked: {new Date().toLocaleTimeString()}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Live</span>
          </div>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SERVICES.map(svc => (
            <div key={svc.name} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svc.icon className={`w-4 h-4 ${svc.color}`} />
                  <span className="text-sm font-medium text-white">{svc.name}</span>
                </div>
                <Badge variant={svc.status === 'online' ? 'success' : 'warning'} dot>
                  {svc.status}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">Latency: <span className="text-gray-300">{svc.latency}</span></p>
            </div>
          ))}
        </div>

        {/* Integration readiness */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Integration Readiness</h3>
          <div className="space-y-3">
            {[
              { name: 'MQTT / IoT Data Ingestion', ready: true, desc: 'Architecture prepared for real-time sensor data via MQTT broker' },
              { name: 'InfluxDB Time-Series Storage', ready: false, desc: 'Connection configured — awaiting InfluxDB endpoint configuration' },
              { name: 'Grafana Dashboard Embedding', ready: false, desc: 'iFrame embedding points identified — pending Grafana setup' },
              { name: 'REST API', ready: true, desc: 'Full CRUD API ready for all resources' },
              { name: 'WebSocket Real-time', ready: true, desc: 'Supabase Realtime subscriptions ready for live data' },
            ].map(item => (
              <div key={item.name} className="flex items-start gap-3 py-3 border-b border-gray-800 last:border-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${item.ready ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <div>
                  <p className="text-xs font-medium text-white">{item.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
                <div className="ml-auto flex-shrink-0">
                  <Badge variant={item.ready ? 'success' : 'warning'} size="sm">
                    {item.ready ? 'Ready' : 'Pending'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Environment info */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Platform Info</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Frontend', value: 'React 18 + Vite + TailwindCSS' },
              { label: 'Database', value: 'PostgreSQL (Supabase)' },
              { label: 'Auth', value: 'Supabase Auth + JWT' },
              { label: 'Charts', value: 'Recharts' },
              { label: 'API', value: 'Supabase REST + Edge Functions' },
              { label: 'Version', value: '1.0.0-beta' },
            ].map(item => (
              <div key={item.label} className="bg-gray-800/40 rounded-xl p-3">
                <p className="text-[10px] text-gray-500 mb-0.5">{item.label}</p>
                <p className="text-xs font-medium text-gray-300">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
