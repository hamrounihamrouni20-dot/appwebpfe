import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchProfiles } from '../../services/users';
import { CheckCircle2, Clock, MessageSquare, Send } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { getTicketNotes, getTicketsByTechnician, updateTicketStatus, addTicketNote } from '../../lib/api';
import emailService from '../../lib/emailService';
import type { Ticket, TicketStatus, TicketNote } from '../../lib/database.types';

export default function TechTicketsPage() {
  const { profile } = useAuth();
  const techId = profile?.id ?? '';
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [note, setNote] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [notes, setNotes] = useState<TicketNote[]>([]);
  const [noteLoading, setNoteLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    async function loadTickets() {
      if (!techId) return;
      try {
        const assignedTickets = await getTicketsByTechnician(techId);
        setTickets(assignedTickets ?? []);
      } catch (error) {
        console.error('Failed to load tickets', error);
      }
    }
    loadTickets();
    const chan = supabase.channel(`tickets_tech_${techId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, payload => {
        if (techId) getTicketsByTechnician(techId).then(t => setTickets(t ?? [])).catch(() => {});
      }).subscribe();

    // load profiles for user name lookups
    (async () => {
      try {
        const profs = await fetchProfiles();
        setProfiles(profs ?? []);
      } catch (err) {
        // ignore
      }
    })();

    return () => { chan.unsubscribe(); };
  }, [techId]);

  useEffect(() => {
    async function loadNotes() {
      if (!selected) return;
      try {
        const ticketNotes = await getTicketNotes(selected.id, 'technician');
        setNotes(ticketNotes ?? []);
      } catch (error) {
        console.error('Failed to load ticket notes', error);
      }
    }
    loadNotes();
  }, [selected]);

  const updateStatus = async (ticketId: string, status: TicketStatus) => {
    setStatusLoading(true);
    try {
      // If marking resolved and a note is present, add a public resolution message
      if (status === 'resolved' && selected && note.trim() && profile?.id) {
        try {
          await addTicketNote(selected.id, profile.id, note.trim(), false);
          // send ticket update email to customer (non-blocking)
          try {
            const customerEmail = profiles.find(p => p.id === selected.created_by)?.email;
            if (customerEmail) {
              await emailService.sendTicketUpdateEmail({ email: customerEmail, ticketTitle: selected.title, status: 'resolved', technicianMessage: note.trim() });
            }
          } catch (err) {
            console.warn('Failed to send ticket update email', err);
          }
          setNote('');
        } catch (err) {
          console.error('Failed to add resolution note', err);
        }
      }

      const updated = await updateTicketStatus(ticketId, status);
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...updated } : t));
      if (selected?.id === ticketId) setSelected(prev => (prev ? { ...prev, ...updated } : null));
    } catch (error) {
      console.error('Failed to update ticket status', error);
    } finally {
      setStatusLoading(false);
    }
  };

  const getUserName = (id: string) => profiles.find(p => p.id === id)?.full_name ?? id;

  const addNote = async () => {
    if (!selected || !note.trim() || !profile?.id) return;
    setNoteLoading(true);
    try {
      const created = await addTicketNote(selected.id, profile.id, note.trim(), isInternal);
      // reload notes to ensure consistency
      const ticketNotes = await getTicketNotes(selected.id, 'technician');
      setNotes(ticketNotes ?? []);
      // If this is a public note, notify the customer via email (non-blocking)
      if (!isInternal) {
        try {
          const customerEmail = profiles.find(p => p.id === selected.created_by)?.email;
          if (customerEmail) {
            await emailService.sendTicketUpdateEmail({ email: customerEmail, ticketTitle: selected.title, status: selected.status, technicianMessage: note.trim() });
          }
        } catch (err) {
          console.warn('Failed to send ticket update email', err);
        }
      }
      setNote('');
      setIsInternal(false);
    } catch (error) {
      console.error('Failed to add ticket note', error);
    } finally {
      setNoteLoading(false);
    }
  };

  const statusColors: Record<TicketStatus, string> = {
    pending: 'bg-amber-500/10 border-amber-500/20',
    assigned: 'bg-blue-500/10 border-blue-500/20',
    in_progress: 'bg-blue-500/10 border-blue-500/20',
    resolved: 'bg-emerald-500/10 border-emerald-500/20',
    closed: 'bg-gray-800 border-gray-700',
  };

  return (
    <AppLayout title="My Tickets">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">My Tickets</h2>
          <p className="text-sm text-gray-400 mt-0.5">{tickets.filter(t => t.status !== 'resolved').length} open tickets assigned to you</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tickets.map(ticket => (
            <div
              key={ticket.id}
              onClick={() => setSelected(ticket)}
              className={`bg-gray-900 border rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:border-gray-700 ${statusColors[ticket.status]}`}
            >
              <div className="flex items-start justify-between mb-3">
                {ticket.status === 'resolved' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-400" />
                )}
                <div className="flex gap-1">
                  <Badge variant={ticket.priority === 'critical' ? 'error' : ticket.priority === 'high' ? 'error' : 'warning'}>
                    {ticket.priority}
                  </Badge>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-white mb-1">{ticket.title}</h3>
              <p className="text-xs text-gray-400 line-clamp-2 mb-3">{ticket.description}</p>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Customer</span>
                  <span className="text-gray-300">{getUserName(ticket.created_by)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Installation</span>
                  <span className="text-gray-300 truncate max-w-[140px]">{ticket.installation_id ?? 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Status</span>
                  <Badge variant={ticket.status === 'resolved' ? 'success' : 'info'} dot>
                    {ticket.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Ticket Details" size="xl">
          <div className="space-y-5">
            <div className="bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-sm font-semibold text-white">{selected.title}</h3>
                <div className="flex gap-1 flex-shrink-0">
                  <Badge variant={selected.priority === 'critical' ? 'error' : 'warning'}>{selected.priority}</Badge>
                  <Badge variant={selected.status === 'resolved' ? 'success' : 'info'} dot>{selected.status.replace('_', ' ')}</Badge>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{selected.description}</p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-gray-700/40 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-500">Customer</p>
                  <p className="text-xs text-white mt-0.5">{getUserName(selected.created_by)}</p>
                </div>
                <div className="bg-gray-700/40 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-500">Installation</p>
                  <p className="text-xs text-white mt-0.5">{selected.installation_id ?? 'N/A'}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-300 mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {(['in_progress', 'resolved'] as TicketStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(selected.id, s)}
                    disabled={statusLoading}
                    className={`px-4 py-2 rounded-xl text-xs font-medium capitalize transition-all ${selected.status === s
                      ? s === 'resolved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'} ${statusLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {s === 'in_progress' ? 'Mark In Progress' : 'Mark Resolved'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-300 mb-2">Technical Notes</p>
              <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                {notes.length === 0 ? (
                  <p className="text-xs text-gray-600 italic">No notes yet. Add your first technical note.</p>
                ) : (
                  notes.map(n => (
                    <div key={n.id} className="flex items-start gap-2 bg-gray-800/50 rounded-lg p-3">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-300">{n.content}</p>
                        <p className="text-[10px] text-gray-600 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addNote()}
                    placeholder="Add technical note..."
                    disabled={noteLoading}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-60"
                  />
                  <button onClick={addNote} disabled={noteLoading} className="px-3 py-2 bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors disabled:opacity-60">
                    <Send className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-gray-400">
                  <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="w-4 h-4 rounded border-gray-700 bg-gray-800" />
                  <span>Internal note (hidden from customer)</span>
                </label>
              </div>
            </div>

            <button onClick={() => setSelected(null)} className="w-full py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
              Close
            </button>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
