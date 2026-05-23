import { supabase } from '../lib/supabase';

export async function getPvReadingsByInstallation(installationId: string, limit = 48) {
  const res = await supabase.from('pv_data').select('*').eq('installation_id', installationId).order('timestamp', { ascending: false }).limit(limit);
  if (res.error) throw res.error;
  return res.data;
}

export async function getLatestPvReadingByInstallation(installationId: string) {
  const res = await supabase.from('pv_data').select('*').eq('installation_id', installationId).order('timestamp', { ascending: false }).limit(1).single();
  if (res.error) throw res.error;
  return res.data;
}

export async function getPvDailySummary(installationId: string, days = 7) {
  const res = await supabase.rpc('pv_daily_summary', { installation_id: installationId, days });
  if (res.error) throw res.error;
  return res.data;
}

export default {
  getPvReadingsByInstallation,
  getLatestPvReadingByInstallation,
  getPvDailySummary,
};
