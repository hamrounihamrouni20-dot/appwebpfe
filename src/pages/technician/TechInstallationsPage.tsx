import { useEffect, useMemo, useState } from 'react';
import { Building2, MapPin, Zap, Sun, Activity } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { getInstallations, getTicketsByTechnician } from '../../lib/api';
import type { Installation, Ticket, InstallationStatus } from '../../lib/database.types';

function statusVariant(status: InstallationStatus) {
  const map = { active: 'success', inactive: 'neutral', maintenance: 'warning', fault: 'error' } as const;
  return map[status];
}

export default function TechInstallationsPage() {
  const { profile } = useAuth();
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    async function loadAssigned() {
      if (!profile?.id) return;
      try {
        const assignedTickets = await getTicketsByTechnician(profile.id);
        setTickets(assignedTickets ?? []);
        const allInstallations = await getInstallations();
        const installationIds = new Set(assignedTickets.map(ticket => ticket.installation_id).filter(Boolean) as string[]);
        setInstallations(allInstallations.filter(inst => installationIds.has(inst.id)));
      } catch (error) {
        console.error('Failed to load installations', error);
      }
    }
    loadAssigned();
  }, [profile?.id]);

  const title = useMemo(() => {
    if (!installations.length) return 'No assigned installations';
    return `${installations.length} installations under your supervision`;
  }, [installations.length]);

  return (
    <AppLayout title="Installations">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Assigned Installations</h2>
          <p className="text-sm text-gray-400 mt-0.5">{title}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {installations.map(inst => (
            <div key={inst.id} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5">
              <div className="h-24 relative bg-gradient-to-br from-amber-500/10 to-orange-500/5 flex items-center justify-center">
                <Building2 className="w-16 h-16 text-amber-500/20" />
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">{inst.name}</h3>
                  <Badge variant={statusVariant(inst.status)} dot>{inst.status}</Badge>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-400">{inst.address}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-800/40 rounded-lg p-2 text-center">
                    <Zap className="w-3.5 h-3.5 text-amber-400 mx-auto mb-0.5" />
                    <p className="text-xs font-bold text-white">{inst.capacity_kw}</p>
                    <p className="text-[10px] text-gray-500">kWp</p>
                  </div>
                  <div className="bg-gray-800/40 rounded-lg p-2 text-center">
                    <Sun className="w-3.5 h-3.5 text-amber-400 mx-auto mb-0.5" />
                    <p className="text-xs font-bold text-white">{inst.panel_count}</p>
                    <p className="text-[10px] text-gray-500">Panels</p>
                  </div>
                  <div className="bg-gray-800/40 rounded-lg p-2 text-center">
                    <Activity className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-0.5" />
                    <p className="text-xs font-bold text-emerald-400">{tickets.filter(ticket => ticket.installation_id === inst.id).length}</p>
                    <p className="text-[10px] text-gray-500">Tickets</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500">Inverter: <span className="text-gray-300">{inst.inverter_model}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
