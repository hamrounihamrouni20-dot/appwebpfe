import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Ticket, Clock, CheckCircle2, AlertCircle, User, Building2, Upload, X } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { getTicketsByUser, createTicket as apiCreateTicket, getTicketNotes } from '../../lib/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { getInstallationsByUser } from '../../services/installations';
import type { Ticket as TicketType, TicketStatus, TicketPriority } from '../../lib/database.types';

function statusVariant(status: TicketStatus) {
  const map = { pending: 'warning', assigned: 'info', in_progress: 'info', resolved: 'success', closed: 'neutral' } as const;
  return map[status] ?? 'neutral';
}

function priorityVariant(priority: TicketPriority) {
  const map = { low: 'neutral', medium: 'warning', high: 'error', critical: 'error' } as const;
  return map[priority] ?? 'neutral';
}

function statusIcon(status: TicketStatus) {
  if (status === 'resolved' || status === 'closed') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === 'pending') return <Clock className="w-4 h-4 text-amber-400" />;
  return <AlertCircle className="w-4 h-4 text-blue-400" />;
}

interface CreateTicketForm {
  title: string;
  description: string;
  priority: TicketPriority;
  installation_id: string;
}

export default function TicketsPage() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<TicketType | null>(null);
  const [form, setForm] = useState<CreateTicketForm>({
    title: '',
    description: '',
    priority: 'medium',
    installation_id: '',
  });
  const [filterStatus, setFilterStatus] = useState<TicketStatus | 'all'>('all');
  const [installations, setInstallations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const filtered = filterStatus === 'all' ? tickets : tickets.filter(t => t.status === filterStatus);

  const createTicket = async () => {
    if (!profile) return alert('You must be signed in');
    if (!form.title.trim() || !form.description.trim()) return alert('Title and description are required');
    setLoading(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        installation_id: form.installation_id || null,
        created_by: profile.id,
      };
      const created = await apiCreateTicket(payload);
      setTickets(prev => [created, ...prev]);
      setShowCreate(false);
      setForm({ title: '', description: '', priority: 'medium', installation_id: '' });
    } catch (err) {
      console.error('createTicket error', err);
      alert('Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  const installationName = (id: string | null) =>
    installations.find(i => i.id === id)?.name ?? 'Unknown';

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!profile) return;
      try {
        const t = await getTicketsByUser(profile.id);
        const inst = await getInstallationsByUser(profile.id);
        if (!mounted) return;
        setTickets(t ?? []);
        setInstallations(inst ?? []);
      } catch (err) {
        console.error('Failed to load tickets/installations', err);
      }
    }
    load();
    // Realtime subscription to tickets (user-specific)
    const channel = supabase.channel(`tickets_user_${profile?.id ?? 'anon'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, payload => {
        // Simple strategy: reload tickets for the user
        if (profile) {
          getTicketsByUser(profile.id).then(t => setTickets(t ?? [])).catch(() => {});
        }
      })
      .subscribe();
    return () => { mounted = false; };
  }, [profile]);

  useEffect(() => {
    let mounted = true;
    async function loadNotesForSelected() {
      if (!selected || !profile) return;
      setNotesLoading(true);
      setNotesError(null);
      try {
        const ticketNotes = await getTicketNotes(selected.id, 'user');
        if (!mounted) return;
        setNotes(ticketNotes ?? []);
      } catch (err) {
        console.error('Failed to load public ticket notes', err);
        if (!mounted) return;
        setNotesError('Unable to load messages');
      } finally {
        if (mounted) setNotesLoading(false);
      }
    }
    loadNotesForSelected();
    return () => { mounted = false; };
  }, [selected, profile]);

  return (
    <AppLayout title="Support Tickets">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Support Tickets</h2>
            <p className="text-sm text-gray-400 mt-0.5">{tickets.filter(t => t.status !== 'resolved').length} open tickets</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </button>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'assigned', 'in_progress', 'resolved'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all capitalize ${filterStatus === s ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'}`}
            >
              {s === 'all' ? 'All Tickets' : s.replace('_', ' ')}
              <span className="ml-1.5 text-gray-500">
                ({s === 'all' ? tickets.length : tickets.filter(t => t.status === s).length})
              </span>
            </button>
          ))}
        </div>

        {/* Tickets list */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
              <Ticket className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No tickets found</p>
              <p className="text-sm text-gray-600 mt-1">Create a new ticket to get support</p>
            </div>
          ) : (
            filtered.map(ticket => (
              <div
                key={ticket.id}
                onClick={() => setSelected(ticket)}
                className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 flex-shrink-0">{statusIcon(ticket.status)}</div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">{ticket.title}</h3>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{ticket.description}</p>
                      <div className="flex items-center flex-wrap gap-2 mt-2">
                        <span className="text-[10px] text-gray-600">
                          {new Date(ticket.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {ticket.installation_id && (
                          <span className="flex items-center gap-1 text-[10px] text-gray-500">
                            <Building2 className="w-3 h-3" />
                            {installationName(ticket.installation_id)}
                          </span>
                        )}
                        {ticket.assigned_to && (
                          <span className="flex items-center gap-1 text-[10px] text-gray-500">
                            <User className="w-3 h-3" />
                            Assigned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <Badge variant={statusVariant(ticket.status)} dot>{ticket.status.replace('_', ' ')}</Badge>
                    <Badge variant={priorityVariant(ticket.priority)}>{ticket.priority}</Badge>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create ticket modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Support Ticket" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Brief description of the issue"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Description *</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe the problem in detail..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as TicketPriority }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Installation</label>
              <select
                value={form.installation_id}
                onChange={e => setForm(f => ({ ...f, installation_id: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              >
                {installations.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Attachment (optional)</label>
            <div className="border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-xl p-6 text-center transition-colors cursor-pointer">
              <Upload className="w-6 h-6 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Drag & drop or click to upload</p>
              <p className="text-[10px] text-gray-600 mt-1">PNG, JPG up to 10MB</p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createTicket}
              disabled={!form.title.trim() || !form.description.trim()}
              className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all"
            >
              Create Ticket
            </button>
          </div>
        </div>
      </Modal>

      {/* Ticket detail modal */}
      {selected && (
        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Ticket Details" size="lg">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">{selected.title}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Created {new Date(selected.created_at).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <Badge variant={statusVariant(selected.status)} dot size="md">{selected.status.replace('_', ' ')}</Badge>
                <Badge variant={priorityVariant(selected.priority)} size="md">{selected.priority} priority</Badge>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-sm text-gray-300 leading-relaxed">{selected.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800/40 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Installation</p>
                <p className="text-sm font-medium text-white">{installationName(selected.installation_id)}</p>
              </div>
              <div className="bg-gray-800/40 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Assigned To</p>
                <p className="text-sm font-medium text-white">{selected.assigned_to ? 'Technician' : 'Unassigned'}</p>
              </div>
            </div>

            <div className="mt-3">
              <p className="text-xs font-medium text-gray-300 mb-2">Messages</p>
              <div className="bg-gray-800/40 rounded-xl p-3 max-h-48 overflow-y-auto">
                {notesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400"><LoadingSpinner size="sm" /> Loading messages...</div>
                ) : notesError ? (
                  <div className="text-sm text-amber-400">{notesError}</div>
                ) : !notes || notes.length === 0 ? (
                  <div className="text-sm text-gray-500 italic">No technician responses yet.</div>
                ) : (
                  notes.map(n => (
                    <div key={n.id} className="mb-3">
                      <p className="text-sm text-gray-200">{n.content}</p>
                      <p className="text-[10px] text-gray-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {selected.status === 'resolved' && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className="text-sm text-emerald-400">
                  Resolved on {selected.resolved_at ? new Date(selected.resolved_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            )}

            <button onClick={() => setSelected(null)} className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors">
              <X className="w-4 h-4" /> Close
            </button>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
