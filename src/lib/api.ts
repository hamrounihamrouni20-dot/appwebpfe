import { supabase } from './supabase';
import emailService from './emailService';
// Generic helper
async function handleResponse<T>(query: Promise<any> | { then?: any }): Promise<T> {
  const res = await query;
  if (res.error) {
    console.error('Supabase error', res.error);
    throw new Error(res.error.message || String(res.error));
  }
  return res.data as T;
}

// PROFILES / USERS
export async function getUsers() {
  return handleResponse<any[]>(
    supabase.from('profiles').select('id, email, full_name, role, phone, address, avatar_url, is_active, created_at').order('created_at', { ascending: false })
  );
}

export async function getTechnicians() {
  return handleResponse<any[]>(
    supabase.from('profiles').select('id, email, full_name, role, phone').eq('role', 'technician').order('full_name')
  );
}

export async function getCustomers() {
  return handleResponse<any[]>(
    supabase.from('profiles').select('id, email, full_name, role, phone').eq('role', 'user').order('full_name')
  );
}

export async function getProfile(userId: string) {
  return handleResponse<any>(
    supabase.from('profiles').select('*').eq('id', userId).single()
  );
}

export async function updateProfile(userId: string, updates: Record<string, any>) {
  return handleResponse<any>(
    supabase.from('profiles').update(updates).eq('id', userId).select().single()
  );
}

// INSTALLATIONS
export async function getInstallations() {
  return handleResponse<any[]>(
    supabase.from('installations').select('id, name, owner_id, address, latitude, longitude, capacity_kw, panel_count, installation_date, status, inverter_model, notes, created_at').order('created_at', { ascending: false })
  );
}

export async function getInstallationById(id: string) {
  return handleResponse<any>(
    supabase.from('installations').select('*').eq('id', id).single()
  );
}

export async function getInstallationsByUser(userId: string) {
  return handleResponse<any[]>(
    supabase.from('installations').select('*').eq('owner_id', userId).order('created_at', { ascending: false })
  );
}

export async function createInstallation(data: Record<string, any>) {
  return handleResponse<any>(
    supabase.from('installations').insert(data).select().single()
  );
}

export async function updateInstallation(id: string, data: Record<string, any>) {
  return handleResponse<any>(
    supabase.from('installations').update(data).eq('id', id).select().single()
  );
}

export async function deleteInstallation(id: string) {
  return handleResponse<any>(
    supabase.from('installations').delete().eq('id', id)
  );
}

// SENSORS
export async function getSensors() {
  return handleResponse<any[]>(
    supabase.from('sensors').select('*').order('created_at', { ascending: false })
  );
}

export async function getSensorsByInstallation(installationId: string) {
  return handleResponse<any[]>(
    supabase.from('sensors').select('*').eq('installation_id', installationId).order('created_at', { ascending: false })
  );
}

export async function createSensor(data: Record<string, any>) {
  return handleResponse<any>(
    supabase.from('sensors').insert(data).select().single()
  );
}

export async function updateSensor(id: string, data: Record<string, any>) {
  return handleResponse<any>(
    supabase.from('sensors').update(data).eq('id', id).select().single()
  );
}

export async function deleteSensor(id: string) {
  return handleResponse<any>(
    supabase.from('sensors').delete().eq('id', id)
  );
}

// TICKETS
export async function getTickets() {
  return handleResponse<any[]>(
    supabase.from('tickets').select('*').order('created_at', { ascending: false })
  );
}

export async function getTicketsByUser(userId: string) {
  return handleResponse<any[]>(
    supabase.from('tickets').select('*').eq('created_by', userId).order('created_at', { ascending: false })
  );
}

export async function getTicketsByTechnician(technicianId: string) {
  return handleResponse<any[]>(
    supabase.from('tickets').select('*').eq('assigned_to', technicianId).order('created_at', { ascending: false })
  );
}

export async function getTicketById(id: string) {
  return handleResponse<any>(
    supabase.from('tickets').select('*').eq('id', id).single()
  );
}

export async function createTicket(data: Record<string, any>) {
  const res = await supabase.from('tickets').insert(data).select().single();
  if (res.error) {
    console.error('createTicket error', res.error);
    throw new Error(res.error.message || String(res.error));
  }
  const ticket = res.data;
  // Non-blocking: send email to ticket owner if possible
  (async () => {
    try {
      let email: string | null = null;
      if ((data as any).email) email = (data as any).email;
      if (!email && ticket?.created_by) {
        const p = await supabase.from('profiles').select('email').eq('id', ticket.created_by).single();
        if (!p.error && p.data) email = p.data.email;
      }
      if (email) {
        await emailService.sendTicketUpdateEmail({ email, ticketTitle: ticket.title || 'Support Ticket', status: ticket.status || 'created', technicianMessage: 'Your ticket has been created.' });
      }
    } catch (err) {
      console.warn('Failed to send ticket creation email', err);
    }
  })();

  return ticket;
}

export async function assignTicket(ticketId: string, technicianId: string) {
  return handleResponse<any>(
    supabase.from('tickets').update({ assigned_to: technicianId, status: 'assigned' }).eq('id', ticketId).select().single()
  );
}

export async function updateTicketStatus(ticketId: string, status: string) {
  const updates: any = { status };
  if (status === 'resolved') updates.resolved_at = new Date().toISOString();
  const updated = await handleResponse<any>(
    supabase.from('tickets').update(updates).eq('id', ticketId).select().single()
  );

  // Non-blocking: notify ticket owner of status change
  (async () => {
    try {
      const ticket = updated;
      if (ticket?.created_by) {
        const p = await supabase.from('profiles').select('email').eq('id', ticket.created_by).single();
        if (!p.error && p.data && p.data.email) {
          await emailService.sendTicketUpdateEmail({ email: p.data.email, ticketTitle: ticket.title || 'Support Ticket', status, technicianMessage: '' });
        }
      }
    } catch (err) {
      console.warn('Failed to send ticket status email', err);
    }
  })();

  return updated;
}

export async function updateTicketPriority(ticketId: string, priority: string) {
  return handleResponse<any>(
    supabase.from('tickets').update({ priority }).eq('id', ticketId).select().single()
  );
}

export async function closeTicket(ticketId: string) {
  return handleResponse<any>(
    supabase.from('tickets').update({ status: 'closed', resolved_at: new Date().toISOString() }).eq('id', ticketId).select().single()
  );
}

export async function deleteTicket(ticketId: string) {
  return handleResponse<any>(
    supabase.from('tickets').delete().eq('id', ticketId)
  );
}

// TICKET NOTES
export async function getTicketNotes(ticketId: string, role?: 'user' | 'technician' | 'admin') {
  // If role is 'user', return only public notes (is_internal = false).
  // If role is omitted or is 'technician'|'admin', return all notes.
  const query = supabase.from('ticket_notes').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
  if (role === 'user') {
    // Only public notes
    return handleResponse<any[]>(
      query.eq('is_internal', false)
    );
  }
  return handleResponse<any[]>(query);
}

export async function addTicketNote(ticketId: string, authorId: string, note: string, is_internal = false) {
  const res = await supabase.from('ticket_notes').insert({ ticket_id: ticketId, author_id: authorId, content: note, is_internal }).select().single();
  if (res.error) {
    console.error('addTicketNote error', res.error);
    throw new Error(res.error.message || String(res.error));
  }
  const created = res.data;
  // Non-blocking: if public note, email ticket owner
  if (!is_internal) {
    (async () => {
      try {
        const t = await supabase.from('tickets').select('id, title, created_by, status').eq('id', ticketId).single();
        if (!t.error && t.data) {
          const ticket = t.data as any;
          if (ticket.created_by) {
            const p = await supabase.from('profiles').select('email').eq('id', ticket.created_by).single();
            if (!p.error && p.data && p.data.email) {
              await emailService.sendTicketUpdateEmail({ email: p.data.email, ticketTitle: ticket.title || 'Support Ticket', status: ticket.status || 'updated', technicianMessage: note });
            }
          }
        }
      } catch (err) {
        console.warn('Failed to send ticket note email', err);
      }
    })();
  }
  return created;
}

// ALERTS
export async function getAlerts() {
  return handleResponse<any[]>(
    supabase.from('alerts').select('*').order('created_at', { ascending: false })
  );
}

export async function getAlertsByUser(userId: string) {
  return handleResponse<any[]>(
    supabase.from('alerts').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  );
}

export async function getAlertsByInstallation(installationId: string) {
  return handleResponse<any[]>(
    supabase.from('alerts').select('*').eq('installation_id', installationId).order('created_at', { ascending: false })
  );
}

export async function createAlert(data: Record<string, any>) {
  return handleResponse<any>(
    supabase.from('alerts').insert(data).select().single()
  );
}

export async function markAlertAsRead(alertId: string) {
  return handleResponse<any>(
    supabase.from('alerts').update({ is_read: true }).eq('id', alertId).select().single()
  );
}

export async function resolveAlert(alertId: string) {
  return handleResponse<any>(
    supabase.from('alerts').update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq('id', alertId).select().single()
  );
}

// NOTIFICATIONS
export async function getNotifications(userId: string) {
  return handleResponse<any[]>(
    supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  );
}

export async function createNotification(data: Record<string, any>) {
  return handleResponse<any>(
    supabase.from('notifications').insert(data).select().single()
  );
}

export async function markNotificationAsRead(notificationId: string) {
  return handleResponse<any>(
    supabase.from('notifications').update({ is_read: true }).eq('id', notificationId).select().single()
  );
}

export async function markAllNotificationsAsRead(userId: string) {
  return handleResponse<any>(
    supabase.from('notifications').update({ is_read: true }).eq('user_id', userId)
  );
}

// PREDICTIONS
export async function getPredictionsByUser(userId: string) {
  return handleResponse<any[]>(
    supabase.from('predictions').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  );
}

export async function getPredictionsByInstallation(installationId: string) {
  return handleResponse<any[]>(
    supabase.from('predictions').select('*').eq('installation_id', installationId).order('created_at', { ascending: false })
  );
}

export async function createPrediction(data: Record<string, any>) {
  return handleResponse<any>(
    supabase.from('predictions').insert(data).select().single()
  );
}

// PV DATA
export async function getPvDataByInstallation(installationId: string) {
  return handleResponse<any[]>(
    supabase.from('pv_data').select('*').eq('installation_id', installationId).order('timestamp', { ascending: false }).limit(200)
  );
}

export async function getPvDataByInstallationRange(installationId: string, start: string, end: string) {
  return handleResponse<any[]>(
    supabase.from('pv_data')
      .select('*')
      .eq('installation_id', installationId)
      .gte('timestamp', start)
      .lte('timestamp', end)
      .order('timestamp', { ascending: true })
  );
}

export async function getLatestPvData(installationId: string) {
  const res = await supabase.from('pv_data').select('*').eq('installation_id', installationId).order('timestamp', { ascending: false }).limit(1).maybeSingle();
  if (res.error) {
    console.error('Supabase error', res.error);
    return null;
  }
  return res.data;
}
