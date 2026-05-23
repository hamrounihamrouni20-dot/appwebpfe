import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/database.types';

export async function fetchProfiles() {
  const res = await supabase.from('profiles').select('id, email, full_name, role, phone, address, avatar_url, is_active, created_at, updated_at').order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return res.data;
}

export async function fetchTechnicians() {
  const res = await supabase.from('profiles').select('id, email, full_name, role, phone').eq('role', 'technician').order('full_name');
  if (res.error) throw res.error;
  return res.data;
}

export async function createProfile(profile: { full_name: string; email: string; role: string; phone?: string }) {
  const res = await supabase.from('profiles').insert(profile).select().single();
  if (res.error) throw res.error;
  return res.data;
}

export interface UserWithStats extends Profile {
  installations_count: number;
  created_tickets_count: number;
  assigned_tickets_count: number;
  last_activity: string;
}

export async function getUsersWithStats() {
  const profilesRes = await supabase
    .from('profiles')
    .select('id, email, full_name, role, phone, address, avatar_url, is_active, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (profilesRes.error) throw profilesRes.error;

  const [installationsRes, createdTicketsRes, assignedTicketsRes] = await Promise.all([
    supabase.from('installations').select('owner_id'),
    supabase.from('tickets').select('created_by'),
    supabase.from('tickets').select('assigned_to'),
  ]);

  const installations = installationsRes.error ? [] : installationsRes.data ?? [];
  const createdTickets = createdTicketsRes.error ? [] : createdTicketsRes.data ?? [];
  const assignedTickets = assignedTicketsRes.error ? [] : assignedTicketsRes.data ?? [];

  if (installationsRes.error || createdTicketsRes.error || assignedTicketsRes.error) {
    console.warn('getUsersWithStats partial fetch failed', {
      installationsError: installationsRes.error,
      createdTicketsError: createdTicketsRes.error,
      assignedTicketsError: assignedTicketsRes.error,
    });
  }

  const installationCounts = installations.reduce((map, item: any) => {
    if (!item.owner_id) return map;
    map.set(item.owner_id, (map.get(item.owner_id) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  const createdTicketCounts = createdTickets.reduce((map, item: any) => {
    if (!item.created_by) return map;
    map.set(item.created_by, (map.get(item.created_by) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  const assignedTicketCounts = assignedTickets.reduce((map, item: any) => {
    if (!item.assigned_to) return map;
    map.set(item.assigned_to, (map.get(item.assigned_to) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  return (profilesRes.data ?? []).map((profile: Profile) => ({
    ...profile,
    installations_count: installationCounts.get(profile.id) ?? 0,
    created_tickets_count: createdTicketCounts.get(profile.id) ?? 0,
    assigned_tickets_count: assignedTicketCounts.get(profile.id) ?? 0,
    last_activity: profile.updated_at || profile.created_at || new Date().toISOString(),
  })) as UserWithStats[];
}

export async function getUserDetails(userId: string) {
  const [profileRes, installationsRes, createdTicketsRes, assignedTicketsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, role, phone, address, avatar_url, is_active, created_at, updated_at')
      .eq('id', userId)
      .single(),
    supabase
      .from('installations')
      .select('id, name, address, device_id, inverter_model, capacity_kw, panel_count, status, installation_date, created_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('tickets')
      .select('id, status, priority, installation_id, created_at')
      .eq('created_by', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('tickets')
      .select('id, status, priority, installation_id, created_at')
      .eq('assigned_to', userId)
      .order('created_at', { ascending: false }),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (installationsRes.error) console.warn('getUserDetails installations failed', installationsRes.error);
  if (createdTicketsRes.error) console.warn('getUserDetails created tickets failed', createdTicketsRes.error);
  if (assignedTicketsRes.error) console.warn('getUserDetails assigned tickets failed', assignedTicketsRes.error);

  const profile = profileRes.data as any;
  const installations = installationsRes.error ? [] : installationsRes.data ?? [];
  const createdTickets = createdTicketsRes.error ? [] : createdTicketsRes.data ?? [];
  const assignedTickets = assignedTicketsRes.error ? [] : assignedTicketsRes.data ?? [];

  return {
    ...profile,
    installations_count: installations.length,
    created_tickets_count: createdTickets.length,
    assigned_tickets_count: assignedTickets.length,
    tickets_count: createdTickets.length + assignedTickets.length,
    installations,
    created_tickets: createdTickets,
    assigned_tickets: assignedTickets,
    last_activity: profile.updated_at || profile.created_at || new Date().toISOString(),
  } as UserWithStats & {
    installations: any[];
    created_tickets: any[];
    assigned_tickets: any[];
    tickets_count: number;
  };
}

export async function getUserInstallations(userId: string) {
  const res = await supabase
    .from('installations')
    .select('id, name, address, device_id, inverter_model, capacity_kw, panel_count, status, installation_date, created_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return res.data;
}

export async function deleteProfile(id: string) {
  const res = await supabase.from('profiles').delete().eq('id', id);
  if (res.error) throw res.error;
  return res;
}

export async function updateProfile(id: string, updates: Record<string, any>) {
  const res = await supabase.from('profiles').update(updates).eq('id', id).select().single();
  if (res.error) throw res.error;
  return res.data;
}

export default {
  fetchProfiles,
  fetchTechnicians,
  createProfile,
  deleteProfile,
  updateProfile,
};
