import { supabase } from '../lib/supabase';

export async function getInstallations() {
  const res = await supabase.from('installations').select('id, name, owner_id, address, latitude, longitude, capacity_kw, panel_count, inverter_model, status, installation_date, created_at').order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return res.data;
}

export async function getInstallationById(id: string) {
  const res = await supabase.from('installations').select('*').eq('id', id).single();
  if (res.error) throw res.error;
  return res.data;
}

export async function getInstallationsByUser(userId: string) {
  const res = await supabase.from('installations').select('*').eq('owner_id', userId).order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return res.data;
}

export async function createInstallation(data: Record<string, any>) {
  const res = await supabase.from('installations').insert(data).select().single();
  if (res.error) throw res.error;
  return res.data;
}

export async function updateInstallation(id: string, data: Record<string, any>) {
  const res = await supabase.from('installations').update(data).eq('id', id).select().single();
  if (res.error) throw res.error;
  return res.data;
}

export async function deleteInstallation(id: string) {
  const res = await supabase.from('installations').delete().eq('id', id);
  if (res.error) throw res.error;
  return res;
}

export default {
  getInstallations,
  getInstallationById,
  getInstallationsByUser,
  createInstallation,
  updateInstallation,
  deleteInstallation,
};
