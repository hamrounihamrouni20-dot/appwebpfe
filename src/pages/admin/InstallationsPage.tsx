import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Building2, MapPin, Zap, Sun, CreditCard as Edit2, BarChart3 } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { getInstallations, getInstallationsByUser, createInstallation } from '../../services/installations';
import { fetchProfiles } from '../../services/users';
import type { Installation, InstallationStatus } from '../../lib/database.types';

function statusVariant(status: InstallationStatus) {
  const map = { active: 'success', inactive: 'neutral', maintenance: 'warning', fault: 'error' } as const;
  return map[status];
}

export default function InstallationsPage() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Installation | null>(null);
  const [form, setForm] = useState({
    name: '', address: '', capacity_kw: '', panel_count: '', owner_id: '', inverter_model: '',
  });
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const getOwnerName = (id: string | null) =>
    id ? (users.find(p => p.id === id)?.full_name ?? 'Unassigned') : 'Unassigned';

  // Clear messages after 4 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [insts, profs] = await Promise.all([getInstallations(), fetchProfiles()]);
        if (!mounted) return;
        setInstallations(insts ?? []);
        setUsers((profs ?? []).filter((p: any) => p.role === 'user'));
      } catch (e) {
        console.error('Failed to load installations', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const chan = supabase.channel('installations_admin').on('postgres_changes', { event: '*', schema: 'public', table: 'installations' }, payload => {
      getInstallations().then(i => setInstallations(i ?? [])).catch(() => {});
    }).subscribe();

    return () => { mounted = false; chan.unsubscribe(); };
  }, []);

  const handleCreate = async () => {
    // Clear previous messages
    setErrorMessage('');
    setSuccessMessage('');

    // Validate required fields
    const name = form.name.trim();
    const address = form.address.trim();
    const capacityStr = String(form.capacity_kw).trim();
    const panelCountStr = String(form.panel_count).trim();

    if (!name || !address) {
      setErrorMessage('Installation name and address are required');
      return;
    }

    if (!capacityStr) {
      setErrorMessage('Capacity (kWp) is required');
      return;
    }

    if (!panelCountStr) {
      setErrorMessage('Panel count is required');
      return;
    }

    // Parse and validate numbers
    const capacityNum = Number(capacityStr);
    const panelCountNum = Number(panelCountStr);

    if (isNaN(capacityNum) || capacityNum <= 0) {
      setErrorMessage('Capacity must be a positive number');
      return;
    }

    if (isNaN(panelCountNum) || panelCountNum <= 0) {
      setErrorMessage('Panel count must be a positive number');
      return;
    }

    setIsCreating(true);
    try {
      const payload: any = {
        name,
        address,
        capacity_kw: capacityNum,
        panel_count: panelCountNum,
        owner_id: form.owner_id || null,
        inverter_model: form.inverter_model.trim() || null,
        status: 'active',
      };
      console.log('Creating installation with payload:', payload);
      const created = await createInstallation(payload);
      console.log('Installation created successfully:', created);
      setInstallations(prev => [created, ...prev]);
      setShowCreate(false);
      setForm({ name: '', address: '', capacity_kw: '', panel_count: '', owner_id: '', inverter_model: '' });
      setSuccessMessage('Installation created successfully');
    } catch (err) {
      console.error('Failed to create installation:', err);
      
      // Extract detailed error message
      let errorMsg = 'Failed to create installation';
      
      if (err instanceof Error) {
        errorMsg += `: ${err.message}`;
      } else if (typeof err === 'object' && err !== null) {
        const errorObj = err as any;
        if (errorObj.message) {
          errorMsg += `: ${errorObj.message}`;
        }
        if (errorObj.details) {
          errorMsg += ` (${errorObj.details})`;
        }
        if (errorObj.hint) {
          errorMsg += ` - Hint: ${errorObj.hint}`;
        }
        if (errorObj.code) {
          errorMsg += ` [${errorObj.code}]`;
        }
      } else {
        errorMsg += `: ${String(err)}`;
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AppLayout title="Installations">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">PV Installations</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {installations.filter(i => i.status === 'active').length} active ·
              {installations.filter(i => i.status === 'maintenance').length} in maintenance
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" /> Add Installation
          </button>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {installations.map(inst => (
            <div
              key={inst.id}
              className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5 cursor-pointer"
              onClick={() => setSelected(inst)}
            >
              {/* Header */}
              <div className="h-32 relative overflow-hidden bg-gradient-to-br from-amber-500/10 to-orange-500/5">
                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                  <Building2 className="w-24 h-24 text-amber-500" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{inst.name}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      <p className="text-xs text-gray-400 truncate max-w-[180px]">{inst.address}</p>
                    </div>
                  </div>
                  <Badge variant={statusVariant(inst.status)} dot>{inst.status}</Badge>
                </div>
              </div>

              <div className="p-4">
                {/* Specs */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Zap className="w-3 h-3 text-amber-400" />
                    </div>
                    <p className="text-sm font-bold text-white">{inst.capacity_kw}</p>
                    <p className="text-[10px] text-gray-500">kWp</p>
                  </div>
                  <div className="text-center border-x border-gray-800">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Sun className="w-3 h-3 text-amber-400" />
                    </div>
                    <p className="text-sm font-bold text-white">{inst.panel_count}</p>
                    <p className="text-[10px] text-gray-500">Panels</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <BarChart3 className="w-3 h-3 text-emerald-400" />
                    </div>
                    <p className="text-sm font-bold text-emerald-400">97%</p>
                    <p className="text-[10px] text-gray-500">Perf.</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="text-gray-500">
                    Owner: <span className="text-gray-300">{getOwnerName(inst.owner_id)}</span>
                  </div>
                  <span className="text-gray-500 text-[10px]">
                    {inst.installation_date ? new Date(inst.installation_date).toLocaleDateString('en', { month: 'short', year: 'numeric' }) : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">All Installations</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs text-gray-500 px-5 py-3">Name</th>
                  <th className="text-left text-xs text-gray-500 px-5 py-3 hidden md:table-cell">Owner</th>
                  <th className="text-left text-xs text-gray-500 px-5 py-3">Capacity</th>
                  <th className="text-left text-xs text-gray-500 px-5 py-3 hidden lg:table-cell">Inverter</th>
                  <th className="text-left text-xs text-gray-500 px-5 py-3">Status</th>
                  <th className="text-right text-xs text-gray-500 px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {installations.map(inst => (
                  <tr key={inst.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-white">{inst.name}</p>
                          <p className="text-xs text-gray-500 hidden sm:block">{inst.address}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell text-xs text-gray-400">{getOwnerName(inst.owner_id)}</td>
                    <td className="px-5 py-4 text-xs text-gray-300">{inst.capacity_kw} kWp / {inst.panel_count} panels</td>
                    <td className="px-5 py-4 hidden lg:table-cell text-xs text-gray-400">{inst.inverter_model}</td>
                    <td className="px-5 py-4"><Badge variant={statusVariant(inst.status)} dot>{inst.status}</Badge></td>
                    <td className="px-5 py-4 text-right">
                      <button className="w-8 h-8 flex items-center justify-center ml-auto rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create installation modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Installation" size="lg">
        <div className="space-y-4">
          {/* Success message */}
          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
              {successMessage}
            </div>
          )}
          
          {/* Error message */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Installation Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                disabled={isCreating}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" placeholder="Rooftop Array Alpha" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Address *</label>
              <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                disabled={isCreating}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" placeholder="123 Solar Ave, City, State" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Capacity (kWp) *</label>
              <input type="number" value={form.capacity_kw} onChange={e => setForm(f => ({ ...f, capacity_kw: e.target.value }))}
                disabled={isCreating}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" placeholder="12.5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Panel Count *</label>
              <input type="number" value={form.panel_count} onChange={e => setForm(f => ({ ...f, panel_count: e.target.value }))}
                disabled={isCreating}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" placeholder="40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Owner</label>
              <select value={form.owner_id} onChange={e => setForm(f => ({ ...f, owner_id: e.target.value }))}
                disabled={isCreating}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <option value="">Select owner...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Inverter Model</label>
              <input type="text" value={form.inverter_model} onChange={e => setForm(f => ({ ...f, inverter_model: e.target.value }))}
                disabled={isCreating}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" placeholder="SolarEdge SE10000H" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowCreate(false)} disabled={isCreating} className="flex-1 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
            <button onClick={handleCreate} disabled={!form.name.trim() || !form.address.trim() || !form.capacity_kw || !form.panel_count || isCreating} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Installation'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail modal */}
      {selected && (
        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Installation Details" size="xl">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Name', value: selected.name },
                { label: 'Status', value: selected.status },
                { label: 'Capacity', value: `${selected.capacity_kw} kWp` },
                { label: 'Panels', value: `${selected.panel_count} units` },
                { label: 'Inverter', value: selected.inverter_model },
                { label: 'Owner', value: getOwnerName(selected.owner_id) },
                { label: 'Installed', value: selected.installation_date ?? 'N/A' },
                { label: 'Address', value: selected.address },
              ].map(item => (
                <div key={item.label} className="bg-gray-800/40 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                  <p className="text-sm font-medium text-white capitalize">{item.value}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setSelected(null)} className="w-full py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">Close</button>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
