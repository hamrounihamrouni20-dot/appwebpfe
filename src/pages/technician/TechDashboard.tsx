import { ClipboardList, CheckCircle2, Clock, AlertCircle, Building2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { getTicketsByTechnician } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { getInstallations } from '../../services/installations';
import type { TicketStatus, TicketPriority } from '../../lib/database.types';

function statusVariant(status: TicketStatus) {
  const map = { pending: 'warning', assigned: 'info', in_progress: 'info', resolved: 'success', closed: 'neutral' } as const;
  return map[status] ?? 'neutral';
}
function priorityVariant(priority: TicketPriority) {
  const map = { low: 'neutral', medium: 'warning', high: 'error', critical: 'error' } as const;
  return map[priority] ?? 'neutral';
}

export default function TechDashboard() {
  const { profile } = useAuth();
  const techId = profile?.id ?? null;
  const [assignedTickets, setAssignedTickets] = useState<any[]>([]);
  const [installations, setInstallations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const openTickets = assignedTickets.filter(t => t.status !== 'resolved' && t.status !== 'closed');
  const resolvedTickets = assignedTickets.filter(t => t.status === 'resolved');
  const criticalTickets = assignedTickets.filter(t => t.priority === 'critical' && t.status !== 'resolved');

  const getUserName = (id: string) => {
    return 'Customer';
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!techId) return;
      setLoading(true);
      try {
        const tickets = await getTicketsByTechnician(techId);
        const inst = await getInstallations();
        if (!mounted) return;
        setAssignedTickets(tickets ?? []);
        setInstallations(inst ?? []);
      } catch (err) {
        console.error('Failed to load technician data', err);
      } finally {
        setLoading(false);
      }
    }
    load();
    const chan = supabase.channel(`tickets_tech_${techId ?? 'anon'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, payload => {
        if (techId) getTicketsByTechnician(techId).then(t => setAssignedTickets(t ?? [])).catch(() => {});
      }).subscribe();
    return () => { mounted = false; chan.unsubscribe(); };
  }, [techId]);

  return (
    <AppLayout title="Technician Dashboard">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Good morning, {profile?.full_name?.split(' ')[0] ?? 'Technician'}</h2>
          <p className="text-sm text-gray-400 mt-0.5">Here's your work overview for today</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Assigned Tickets" value={assignedTickets.length} icon={<ClipboardList className="w-5 h-5" />} color="blue" />
          <StatCard label="Open" value={openTickets.length} icon={<Clock className="w-5 h-5" />} color="amber" />
          <StatCard label="Critical" value={criticalTickets.length} icon={<AlertCircle className="w-5 h-5" />} color="rose" />
          <StatCard label="Resolved" value={resolvedTickets.length} icon={<CheckCircle2 className="w-5 h-5" />} color="emerald" />
        </div>

        {/* Open tickets */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Open Tickets</h3>
            <Badge variant={openTickets.length > 0 ? 'warning' : 'success'} dot>
              {openTickets.length} pending
            </Badge>
          </div>
          {openTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
              <p className="text-gray-400 font-medium">All clear!</p>
              <p className="text-sm text-gray-600 mt-1">No open tickets assigned to you</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {openTickets.map(ticket => {
                const installation = installations.find(i => i.id === ticket.installation_id);
                return (
                  <div key={ticket.id} className="px-5 py-4 hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h4 className="text-sm font-medium text-white">{ticket.title}</h4>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{ticket.description}</p>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <Badge variant={priorityVariant(ticket.priority)}>{ticket.priority}</Badge>
                        <Badge variant={statusVariant(ticket.status)} dot>{ticket.status.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center flex-wrap gap-3 mt-2">
                      <span className="text-xs text-gray-500">
                        Customer: <span className="text-gray-300">{getUserName(ticket.created_by)}</span>
                      </span>
                      {installation && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Building2 className="w-3 h-3" />
                          {installation.name}
                        </span>
                      )}
                      <span className="text-xs text-gray-600">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                      <button className="ml-auto px-3 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs rounded-lg transition-colors">
                        Update Status
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Assigned installations */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Assigned Installations</h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(function(){
              const assignedIds = Array.from(new Set(assignedTickets.map(t => t.installation_id).filter(Boolean)));
              const assignedInst = installations.filter(i => assignedIds.includes(i.id)).slice(0,3);
              return assignedInst.map(inst => (
              <div key={inst.id} className="bg-gray-800/40 rounded-xl p-4 hover:bg-gray-800/60 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  <Badge variant={inst.status === 'active' ? 'success' : 'warning'} dot>{inst.status}</Badge>
                </div>
                <h4 className="text-sm font-medium text-white mt-2">{inst.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{inst.address}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700/50">
                  <span className="text-xs text-gray-400">{inst.capacity_kw} kWp</span>
                  <span className="text-xs text-gray-400">{inst.panel_count} panels</span>
                </div>
              </div>
              ));
            })()}
          </div>
        </div>

        {/* Resolved history */}
        {resolvedTickets.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Recently Resolved</h3>
            </div>
            <div className="divide-y divide-gray-800/60">
              {resolvedTickets.map(ticket => (
                <div key={ticket.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-800/30 transition-colors">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 truncate">{ticket.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Resolved {ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <Badge variant="success">resolved</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
