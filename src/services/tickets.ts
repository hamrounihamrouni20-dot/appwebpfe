import { supabase } from '../lib/supabase';

export async function getTickets() {
  const res = await supabase.from('tickets').select('*').order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return res.data;
}

export async function getTicketsByUser(userId: string) {
  const res = await supabase.from('tickets').select('*').eq('created_by', userId).order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return res.data;
}

export async function getTicketsByTechnician(technicianId: string) {
  const res = await supabase.from('tickets').select('*').eq('assigned_to', technicianId).order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return res.data;
}

export async function createTicket(data: Record<string, any>) {
  const res = await supabase.from('tickets').insert(data).select().single();
  if (res.error) throw res.error;
  return res.data;
}

export async function updateTicket(ticketId: string, updates: Record<string, any>) {
  const res = await supabase.from('tickets').update(updates).eq('id', ticketId).select().single();
  if (res.error) throw res.error;
  return res.data;
}

export async function deleteTicket(ticketId: string) {
  const res = await supabase.from('tickets').delete().eq('id', ticketId);
  if (res.error) throw res.error;
  return res;
}

export default {
  getTickets,
  getTicketsByUser,
  getTicketsByTechnician,
  createTicket,
  updateTicket,
  deleteTicket,
};
