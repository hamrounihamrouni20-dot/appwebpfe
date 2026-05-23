import { useEffect, useState } from 'react';
import { Filter, UserCheck, X } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { getTickets, getTechnicians, assignTicket, updateTicketStatus, getTicketNotes } from '../../lib/api';
import { fetchProfiles } from '../../services/users';
import { supabase } from '../../lib/supabase';
import type { Ticket, TicketStatus, TicketPriority } from '../../lib/database.types';

function statusVariant(status: TicketStatus) {
  const map = { pending: 'warning', assigned: 'info', in_progress: 'info', resolved: 'success', closed: 'neutral' } as const;
  return map[status] ?? 'neutral';
}
function priorityVariant(priority: TicketPriority) {
  const map = { low: 'neutral', medium: 'warning', high: 'error', critical: 'error' } as const;
  return map[priority] ?? 'neutral';
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profilesState, setProfiles] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [tk, techs] = await Promise.all([getTickets(), getTechnicians()]);
        if (!mounted) return;
        setTickets(tk ?? []);
        setTechnicians(techs ?? []);
        // fetch profiles to show customer names
        try {
          const profs = await fetchProfiles();
          if (mounted) setProfiles(profs ?? []);
        } catch (err) {
          // ignore
        }
      } catch (e) {
        console.error('Failed to load tickets', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const channel = supabase.channel('tickets_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, payload => {
      getTickets().then(t => setTickets(t ?? [])).catch(() => {});
    }).subscribe();
    return () => { mounted = false; channel.unsubscribe(); };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadNotes() {
      if (!selected) return;
      setNotesLoading(true);
      setNotesError(null);
      try {
        const ticketNotes = await getTicketNotes(selected.id, 'admin');
        if (!mounted) return;
        setNotes(ticketNotes ?? []);
      } catch (err) {
        console.error('Failed to load ticket notes for admin', err);
        if (!mounted) return;
        setNotesError('Unable to load notes');
      } finally {
        if (mounted) setNotesLoading(false);
      }
    }
    loadNotes();
    return () => { mounted = false; };
  }, [selected]);

  const filtered = tickets.filter(t => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchStatus && matchPriority;
  });

  const assignTech = async (ticketId: string, techId: string) => {
    try {
      const res = await assignTicket(ticketId, techId);
      setTickets(prev => prev.map(t => t.id === ticketId ? res ?? { ...t, assigned_to: techId, status: 'assigned' } : t));
    } catch (e) {
      console.error('Failed to assign tech', e);
    }
  };

  const changeStatus = async (ticketId: string, status: TicketStatus) => {
    try {
      const res = await updateTicketStatus(ticketId, status);
      setTickets(prev => prev.map(t => t.id === ticketId ? res ?? { ...t, status, resolved_at: status === 'resolved' ? new Date().toISOString() : t.resolved_at } : t));
    } catch (e) {
      console.error('Failed to update status', e);
    }
  };

  const getUserName = (id: string) => profilesState.find(p => p.id === id)?.full_name ?? id ?? 'Unknown';
  const getTechName = (id: string | null) => id ? (technicians.find(p => p.id === id)?.full_name ?? 'Unknown') : 'Unassigned';

  return (
    <AppLayout title="Ticket Management">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Ticket Management</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {tickets.filter(t => t.status === 'pending').length} pending ·
            {tickets.filter(t => t.status === 'assigned').length} assigned ·
            {tickets.filter(t => t.status === 'in_progress').length} in progress
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <div className="flex gap-1 flex-wrap">
              {(['all', 'pending', 'assigned', 'in_progress', 'resolved'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize ${statusFilter === s ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {(['all', 'low', 'medium', 'high', 'critical'] as const).map(p => (
              <button key={p} onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize ${priorityFilter === p ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs text-gray-500 px-5 py-3">Ticket</th>
                  <th className="text-left text-xs text-gray-500 px-5 py-3 hidden md:table-cell">Created By</th>
                  <th className="text-left text-xs text-gray-500 px-5 py-3">Priority</th>
                  <th className="text-left text-xs text-gray-500 px-5 py-3">Status</th>
                  <th className="text-left text-xs text-gray-500 px-5 py-3 hidden lg:table-cell">Assigned To</th>
                  <th className="text-right text-xs text-gray-500 px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ticket => (
                  <tr key={ticket.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-white">{ticket.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{ticket.description}</p>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell text-xs text-gray-400">{getUserName(ticket.created_by)}</td>
                    <td className="px-5 py-4">
                      <Badge variant={priorityVariant(ticket.priority)}>{ticket.priority}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={statusVariant(ticket.status)} dot>{ticket.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell text-xs text-gray-400">{getTechName(ticket.assigned_to)}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setSelected(ticket)}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs text-gray-300 rounded-lg transition-colors"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ticket management modal */}
      {selected && (
        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Manage Ticket" size="lg">
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-sm font-semibold text-white">{selected.title}</h3>
                <div className="flex gap-1">
                  <Badge variant={priorityVariant(selected.priority)}>{selected.priority}</Badge>
                  <Badge variant={statusVariant(selected.status)} dot>{selected.status.replace('_', ' ')}</Badge>
                </div>
              </div>
              <p className="text-xs text-gray-400">{selected.description}</p>
              <p className="text-xs text-gray-600 mt-2">
                By {getUserName(selected.created_by)} · {new Date(selected.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="mt-3">
              <p className="text-xs font-medium text-gray-300 mb-2">Notes</p>
              <div className="bg-gray-800/40 rounded-xl p-3 max-h-48 overflow-y-auto">
                {notesLoading ? (
                  <div className="text-sm text-gray-400">Loading notes...</div>
                ) : notesError ? (
                  <div className="text-sm text-amber-400">{notesError}</div>
                ) : !notes || notes.length === 0 ? (
                  <div className="text-sm text-gray-500 italic">No notes yet.</div>
                ) : (
                  notes.map(n => (
                    <div key={n.id} className="mb-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-200">{n.content}</p>
                        <Badge variant={n.is_internal ? 'neutral' : 'success'}>{n.is_internal ? 'Internal' : 'Public'}</Badge>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2">Assign Technician</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {technicians.map(tech => (
                  <button
                    key={tech.id}
                    onClick={() => assignTech(selected.id, tech.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${selected.assigned_to === tech.id
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'}`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-400 text-xs font-bold">{tech.full_name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium">{tech.full_name}</p>
                      <p className="text-[10px] text-gray-500">{tickets.filter(t => t.assigned_to === tech.id && t.status !== 'resolved').length} open tickets</p>
                    </div>
                    {selected.assigned_to === tech.id && <UserCheck className="w-4 h-4 ml-auto" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2">Change Status</label>
              <div className="flex flex-wrap gap-2">
                {(['pending', 'assigned', 'in_progress', 'resolved', 'closed'] as TicketStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => changeStatus(selected.id, s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${selected.status === s
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'}`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setSelected(null)} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
                <X className="w-4 h-4" /> Close
              </button>
              <button onClick={() => setSelected(null)} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-medium transition-all">
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
