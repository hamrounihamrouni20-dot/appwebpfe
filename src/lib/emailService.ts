const MAIL_SERVER_URL = import.meta.env.VITE_MAIL_SERVER_URL || 'http://localhost:5000';

async function postJson(path: string, body: any) {
  try {
    const res = await fetch(`${MAIL_SERVER_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: any = {};
    if (text) {
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
    }
    if (!res.ok) return { success: false, error: data.error || data.raw || `HTTP ${res.status}` };
    return { success: true, error: null, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendWelcomeEmail({ fullName, email, password, role }: { fullName: string; email: string; password: string; role: string; }) {
  return postJson('/send-welcome-email', { fullName, email, password, role });
}

export async function sendTicketUpdateEmail({ email, ticketTitle, status, technicianMessage }: { email: string; ticketTitle: string; status: string; technicianMessage?: string; }) {
  return postJson('/send-ticket-update', { email, ticketTitle, status, technicianMessage });
}

export async function sendAlertEmail({ email, alertType, alertMessage, severity }: { email: string; alertType: string; alertMessage: string; severity?: string; }) {
  return postJson('/send-alert', { email, alertType, alertMessage, severity });
}

export async function sendPasswordResetEmail({ email, resetLink }: { email: string; resetLink: string; }) {
  return postJson('/send-password-reset', { email, resetLink });
}

export async function requestPasswordReset(email: string) {
  return postJson('/send-password-reset', { email });
}

export default {
  sendWelcomeEmail,
  sendTicketUpdateEmail,
  sendAlertEmail,
  sendPasswordResetEmail,
  requestPasswordReset,
};
