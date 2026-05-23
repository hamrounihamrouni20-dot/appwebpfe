import { useEffect, useMemo, useState } from 'react';
import { Plus, Wrench, ClipboardList, CheckCircle2, Clock, Star } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { getTechnicians, getTickets } from '../../lib/api';
import type { Profile, Ticket } from '../../lib/database.types';

export default function TechniciansPage() {
  const [techs, setTechs] = useState<Profile[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', specialization: 'General' });

  useEffect(() => {
    async function loadData() {
      try {
        const [technicians, allTickets] = await Promise.all([getTechnicians(), getTickets()]);
        setTechs(technicians ?? []);
        setTickets(allTickets ?? []);
      } catch (error) {
        console.error('Failed to load technicians', error);
      }
    }
    loadData();
  }, []);

  const getTechTickets = (techId: string) => tickets.filter(t => t.assigned_to === techId);
  const getTechResolved = (techId: string) => tickets.filter(t => t.assigned_to === techId && t.status === 'resolved');

  const assignedTickets = useMemo(() => tickets.filter(t => t.assigned_to), [tickets]);

  return (
    <AppLayout title="Technicians">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Technician Management</h2>
            <p className="text-sm text-gray-400 mt-0.5">{techs.length} active technicians</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" /> Add Technician
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {techs.map(tech => {
            const assigned = getTechTickets(tech.id);
            const resolved = getTechResolved(tech.id);
            const openCount = assigned.filter(t => t.status !== 'resolved').length;
            const resolutionRate = assigned.length > 0 ? Math.round((resolved.length / assigned.length) * 100) : 0;

            return (
              <div key={tech.id} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 transition-all hover:-translate-y-0.5">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-400 text-lg font-bold">{tech.full_name?.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white">{tech.full_name}</h3>
                    <p className="text-xs text-gray-500 truncate">{tech.email}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="info">Technician</Badge>
                    </div>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full ${tech.is_active ? 'bg-emerald-400' : 'bg-gray-500'} flex-shrink-0 mt-1`} />
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-gray-800/60 rounded-xl p-2.5 text-center">
                    <p className="text-lg font-bold text-white">{assigned.length}</p>
                    <p className="text-[10px] text-gray-500">Total</p>
                  </div>
                  <div className="bg-gray-800/60 rounded-xl p-2.5 text-center">
                    <p className="text-lg font-bold text-amber-400">{openCount}</p>
                    <p className="text-[10px] text-gray-500">Open</p>
                  </div>
                  <div className="bg-gray-800/60 rounded-xl p-2.5 text-center">
                    <p className="text-lg font-bold text-emerald-400">{resolved.length}</p>
                    <p className="text-[10px] text-gray-500">Resolved</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">Resolution rate</span>
                    <span className="text-xs font-semibold text-emerald-400">{resolutionRate}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${resolutionRate}%` }} />
                  </div>
                </div>

                {assigned.slice(0, 2).map(t => (
                  <div key={t.id} className="flex items-center gap-2 py-1.5 border-t border-gray-800/60 first:border-t-0">
                    {t.status === 'resolved' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    )}
                    <p className="text-xs text-gray-400 truncate">{t.title}</p>
                  </div>
                ))}

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-800">
                  <Wrench className="w-3.5 h-3.5 text-gray-600" />
                  <span className="text-xs text-gray-500">{tech.phone || 'No phone'}</span>
                  <div className="ml-auto flex items-center gap-1 text-xs text-amber-400">
                    <Star className="w-3 h-3 fill-amber-400" />
                    <span>{Math.floor(4 + Math.random() * 2)}.{Math.floor(1 + Math.random() * 9)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
            <ClipboardList className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Active Ticket Assignments</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs text-gray-500 px-5 py-3">Ticket</th>
                  <th className="text-left text-xs text-gray-500 px-5 py-3">Assigned To</th>
                  <th className="text-left text-xs text-gray-500 px-5 py-3">Priority</th>
                  <th className="text-left text-xs text-gray-500 px-5 py-3">Status</th>
                  <th className="text-left text-xs text-gray-500 px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {assignedTickets.map(ticket => {
                  const tech = techs.find(t => t.id === ticket.assigned_to);
                  return (
                    <tr key={ticket.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-white">{ticket.title}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-500/20 flex items-center justify-center">
                            <span className="text-blue-400 text-[10px] font-bold">{tech?.full_name?.charAt(0) ?? '?'}</span>
                          </div>
                          <span className="text-xs text-gray-300">{tech?.full_name ?? 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={ticket.priority === 'critical' ? 'error' : ticket.priority === 'high' ? 'error' : 'warning'}>
                          {ticket.priority}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={ticket.status === 'resolved' ? 'success' : 'info'}>
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Technician">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Full Name *</label>
            <input type="text" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors" placeholder="Jane Smith" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Email *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors" placeholder="tech@solarwatch.io" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Phone</label>
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors" placeholder="+1 (555) 000-0000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Specialization</label>
            <select value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors">
              <option>General</option>
              <option>Inverter Specialist</option>
              <option>Panel Installation</option>
              <option>Electrical</option>
              <option>IoT / Monitoring</option>
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">Cancel</button>
            <button onClick={() => setShowCreate(false)} disabled={!form.full_name || !form.email} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all">Create Account</button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
