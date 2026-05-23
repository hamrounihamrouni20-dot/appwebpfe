import { supabase } from '../lib/supabase';
import emailService from '../lib/emailService';

export async function getAlerts() {
  const res = await supabase.from('alerts').select('*').order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return res.data;
}

export async function getAlertsByUser(userId: string) {
  const res = await supabase.from('alerts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return res.data;
}

export async function markAlertAsRead(id: string) {
  const res = await supabase.from('alerts').update({ is_read: true }).eq('id', id).select().single();
  if (res.error) throw res.error;
  return res.data;
}

export async function markAlertAsResolved(id: string) {
  const res = await supabase.from('alerts').update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq('id', id).select().single();
  if (res.error) throw res.error;
  return res.data;
}

export async function createAlert(alert: Record<string, any>) {
  const res = await supabase.from('alerts').insert(alert).select().single();
  if (res.error) throw res.error;
  // Non-blocking: send email for critical alerts
  (async () => {
    try {
      const a = res.data as any;
      const severity = a.severity || a.level || 'info';
      if (severity === 'critical') {
        let email = a.email;
        if (!email && a.user_id) {
          const p = await supabase.from('profiles').select('email').eq('id', a.user_id).single();
          if (!p.error && p.data) email = p.data.email;
        }
        if (email) {
          await emailService.sendAlertEmail({ email, alertType: a.type || 'Alert', alertMessage: a.message || a.alert || '', severity });
        }
      }
    } catch (err) {
      console.warn('Failed to send alert email', err);
    }
  })();
  return res.data;
}

export default {
  getAlerts,
  getAlertsByUser,
  markAlertAsRead,
  markAlertAsResolved,
  createAlert,
};
