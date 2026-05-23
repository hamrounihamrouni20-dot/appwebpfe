import { supabase } from '../lib/supabase';
import type { PvData, Sensor } from '../lib/database.types';

export async function getInstallationLiveData(installationId: string) {
  const latest = await supabase
    .from('pv_data')
    .select('id, installation_id, sensor_id, timestamp, voltage, current_a, power_w, temperature_c, irradiance_wm2, energy_kwh, created_at')
    .eq('installation_id', installationId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest.error) throw latest.error;
  return latest.data as PvData | null;
}

export async function getInstallationHistory(installationId: string, limit = 24) {
  const res = await supabase
    .from('pv_data')
    .select('id, installation_id, sensor_id, timestamp, voltage, current_a, power_w, temperature_c, irradiance_wm2, energy_kwh, created_at')
    .eq('installation_id', installationId)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (res.error) throw res.error;
  return (res.data ?? []) as PvData[];
}

export async function getInstallationSensors(installationId: string) {
  const res = await supabase
    .from('sensors')
    .select('id, installation_id, name, sensor_type, device_id, is_online, last_seen, created_at')
    .eq('installation_id', installationId)
    .order('created_at', { ascending: false });

  if (res.error) throw res.error;
  return (res.data ?? []) as Sensor[];
}

export async function getInstallationLiveOverview(installationId: string) {
  const [live, sensors] = await Promise.all([
    getInstallationLiveData(installationId),
    getInstallationSensors(installationId),
  ]);

  return {
    live,
    sensors,
  };
}
