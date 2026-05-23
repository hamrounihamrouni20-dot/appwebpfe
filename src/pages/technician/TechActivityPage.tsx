import { Activity, CheckCircle2, Clock, Wrench, Calendar } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getTicketsByTechnician } from '../../services/tickets';

const activityLog = [
  { id: '1', type: 'resolved', text: 'Resolved ticket: Annual maintenance request', time: '2024-01-10 16:00', icon: CheckCircle2, color: 'text-emerald-400' },
  { id: '2', type: 'assigned', text: 'Assigned to: Inverter showing error code E07', time: '2024-01-14 11:00', icon: Wrench, color: 'text-blue-400' },
  { id: '3', type: 'visit', text: 'Site visit: Rooftop Array Alpha inspection', time: '2024-01-13 09:30', icon: Activity, color: 'text-amber-400' },
  { id: '4', type: 'note', text: 'Added technical note to ticket #SW-2024-002', time: '2024-01-13 10:15', icon: Clock, color: 'text-gray-400' },
  { id: '5', type: 'resolved', text: 'Completed panel cleaning service', time: '2024-01-08 14:00', icon: CheckCircle2, color: 'text-emerald-400' },
];

export default function TechActivityPage() {
  const { profile } = useAuth();
  const [resolvedCount, setResolvedCount] = useState(0);
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!profile?.id) return;
      try {
        const tickets = await getTicketsByTechnician(profile.id);
        if (!mounted) return;
        setResolvedCount((tickets ?? []).filter((t: any) => t.status === 'resolved').length);
      } catch (e) {
        console.error('Failed to load technician tickets', e);
      }
    }
    load();
    return () => { mounted = false; };
  }, [profile?.id]);

  const resolved = resolvedCount;

  return (
    <AppLayout title="Activity">
      <div className="p-6 space-y-6 max-w-3xl">
        <div>
          <h2 className="text-xl font-bold text-white">Activity Log</h2>
          <p className="text-sm text-gray-400 mt-0.5">Your recent actions and work history</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Tickets Resolved', value: resolved.length, color: 'text-emerald-400' },
            { label: 'Site Visits', value: 8, color: 'text-amber-400' },
            { label: 'Hours Logged', value: '42h', color: 'text-blue-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
          </div>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-800" />
            <div className="space-y-4">
              {activityLog.map(item => (
                <div key={item.id} className="flex items-start gap-4 relative pl-8">
                  <div className="absolute left-0 top-1 w-8 h-8 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center">
                    <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                  </div>
                  <div className="flex-1 bg-gray-800/40 rounded-xl p-3">
                    <p className="text-xs font-medium text-gray-200">{item.text}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
