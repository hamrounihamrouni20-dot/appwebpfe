require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD_RESET_REDIRECT_URL = process.env.PASSWORD_RESET_REDIRECT_URL || `${APP_URL}/reset-password`;

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn('EMAIL_USER or EMAIL_PASS not set. Emails will fail until configured.');
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Password reset link generation will not work.');
}

// Nodemailer transporter using Gmail SMTP with App Password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendMail(mailOptions) {
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true };
  } catch (err) {
    console.error('Failed to send email', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function welcomeHtml({ fullName, email, password, role }) {
  return `
  <div style="font-family: Inter, Arial, sans-serif; color: #e6eef8; background: #0b1220; padding: 24px;">
    <div style="max-width:600px;margin:0 auto;background:#0f1724;border-radius:12px;padding:24px;border:1px solid #111827;">
      <h2 style="color:#f8f3ec;margin:0 0 8px;">Welcome to SolarWatch, ${fullName}</h2>
      <p style="color:#9ca3af;margin:0 0 16px;">Your account has been created. Use the credentials below to sign in.</p>
      <div style="background:#0b1220;border-radius:8px;padding:16px;margin-bottom:16px;border:1px solid #111827;">
        <p style="margin:0;color:#f3f4f6;font-size:14px;"><strong>Email:</strong> ${email}</p>
        <p style="margin:8px 0 0;color:#f3f4f6;font-size:14px;"><strong>Password:</strong> ${password}</p>
        <p style="margin:8px 0 0;color:#f3f4f6;font-size:14px;"><strong>Role:</strong> ${role}</p>
      </div>
      <div style="text-align:center;margin-bottom:12px;"><a href="${APP_URL}" style="background:#f59e0b;color:#0b1220;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700;">Sign in to SolarWatch</a></div>
      <p style="color:#9ca3af;font-size:12px;margin:0;">We recommend changing your password after first login.</p>
      <div style="margin-top:16px;font-size:12px;color:#6b7280;text-align:center;">SolarWatch</div>
    </div>
  </div>`;
}

function ticketUpdateHtml({ ticketTitle, status, technicianMessage }) {
  return `
  <div style="font-family: Inter, Arial, sans-serif; color: #e6eef8; background: #0b1220; padding: 24px;">
    <div style="max-width:600px;margin:0 auto;background:#0f1724;border-radius:12px;padding:24px;border:1px solid #111827;">
      <h3 style="color:#f8f3ec;margin:0 0 8px;">Update on ticket: ${ticketTitle}</h3>
      <p style="color:#9ca3af;margin:0 0 8px;">Status: <strong style="color:#f3f4f6">${status}</strong></p>
      <div style="background:#081026;border-radius:8px;padding:12px;margin-top:12px;border-left:4px solid #f59e0b;">
        <p style="margin:0;color:#e6eef8">${technicianMessage}</p>
      </div>
      <div style="margin-top:16px;text-align:center;"><a href="${APP_URL}" style="background:#f59e0b;color:#0b1220;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;">View Ticket</a></div>
      <div style="margin-top:16px;font-size:12px;color:#6b7280;text-align:center;">SolarWatch</div>
    </div>
  </div>`;
}

function alertHtml({ alertType, alertMessage, severity }) {
  const color = severity === 'critical' ? '#ef4444' : severity === 'warning' ? '#f59e0b' : '#60a5fa';
  return `
  <div style="font-family: Inter, Arial, sans-serif; color: #e6eef8; background: #0b1220; padding: 24px;">
    <div style="max-width:600px;margin:0 auto;background:#0f1724;border-radius:12px;padding:24px;border:1px solid #111827;">
      <h3 style="color:#f8f3ec;margin:0 0 8px;">${alertType}</h3>
      <p style="color:#9ca3af;margin:0 0 12px;">${alertMessage}</p>
      <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:${color};color:#081026;font-weight:700;">${severity.toUpperCase()}</div>
      <div style="margin-top:16px;font-size:12px;color:#6b7280;text-align:center;">SolarWatch</div>
    </div>
  </div>`;
}

const GROK_API_KEY = process.env.GROK_API_KEY;
const SUPABASE_API_BASE = SUPABASE_URL ? SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1' : '';

function summarizeRecentRows(rows, key) {
  const items = rows.slice(0, 3).map((row) => `- ${row[key]} (${row.status ?? row.severity ?? 'unknown'})`);
  return items.length ? items.join('\n') : 'None';
}

function average(values) {
  const positive = values.filter((value) => typeof value === 'number' && !Number.isNaN(value));
  return positive.length ? positive.reduce((sum, value) => sum + value, 0) / positive.length : 0;
}

function sum(values) {
  return values.filter((value) => typeof value === 'number' && !Number.isNaN(value)).reduce((total, value) => total + value, 0);
}

async function supabaseFetch(path) {
  if (!SUPABASE_API_BASE) {
    throw new Error('SUPABASE_URL not configured');
  }

  const response = await fetch(`${SUPABASE_API_BASE}/${path}`, {
    headers: {
      Accept: 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || JSON.stringify(data));
  }
  return data;
}

function parseGrokText(result) {
  if (typeof result.output === 'string') return result.output;
  if (Array.isArray(result.output)) {
    return result.output.map((item) => typeof item === 'string' ? item : item?.content || item?.text || '').join('\n');
  }
  if (result.completion) return result.completion;
  if (Array.isArray(result.choices) && result.choices[0]) {
    return result.choices[0]?.message?.content || result.choices[0]?.text || '';
  }
  return '';
}

async function queryGrok(prompt) {
  if (GROK_API_KEY && GROK_API_KEY.startsWith('gsk_')) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1024,
        }),
      });

      const groqJson = await response.json();
      if (!response.ok) {
        if (response.status === 404 || groqJson?.error?.code === 'model_not_found') {
          const fallbackResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${GROK_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'llama3-8b-8192',
              messages: [
                { role: 'user', content: prompt }
              ],
              temperature: 0.3,
              max_tokens: 1024,
            }),
          });
          const fallbackData = await fallbackResponse.json();
          if (!fallbackResponse.ok) {
            throw new Error(fallbackData?.error?.message || JSON.stringify(fallbackData));
          }
          return fallbackData;
        }
        throw new Error(groqJson?.error?.message || JSON.stringify(groqJson));
      }
      return groqJson;
    } catch (err) {
      console.warn('Groq query failed, trying standard Grok endpoints', err);
    }
  }

  const endpoints = [
    'https://api.grok.x.ai/v1/complete',
    'https://api.grok.ai/v1/complete',
  ];

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'grok-1',
          input: prompt,
          temperature: 0.2,
          max_tokens: 512,
        }),
      });

      const grokJson = await response.json();
      if (!response.ok) {
        throw new Error(grokJson?.error?.message || JSON.stringify(grokJson));
      }

      return grokJson;
    } catch (error) {
      console.warn(`Grok endpoint ${endpoint} failed:`, error instanceof Error ? error.message : error);
      lastError = error;
    }
  }

  throw new Error(lastError instanceof Error ? lastError.message : String(lastError));
}

app.post('/grok-query', async (req, res) => {
  try {
    const { profileId, message, history } = req.body || {};
    if (!message) {
      return res.status(400).json({ success: false, error: 'Missing message' });
    }
    if (!GROK_API_KEY) {
      return res.status(500).json({ success: false, error: 'GROK_API_KEY is not configured on the server' });
    }

    let profile = null;
    let installation = null;
    let alerts = [];
    let tickets = [];
    let telemetryRows = [];
    let liveTelemetry = null;

    if (profileId) {
      const profileResults = await supabaseFetch(`profiles?select=id,full_name,email&id=eq.${encodeURIComponent(profileId)}`);
      profile = profileResults?.[0] ?? null;

      const installationResults = await supabaseFetch(`installations?select=id,name,address,capacity_kw,panel_count,inverter_model,status,installation_date,device_id&owner_id=eq.${encodeURIComponent(profileId)}&order=created_at.desc&limit=1`);
      installation = installationResults?.[0] ?? null;
    }

    if (installation) {
      let fetchedFromNodeRed = false;
      if (installation.device_id) {
        try {
          const telemetryResponse = await fetch(`http://localhost:1880/api/telemetry/${installation.device_id}`);
          if (telemetryResponse.ok) {
            liveTelemetry = await telemetryResponse.json();
          }

          const analyticsResponse = await fetch(`http://localhost:1880/api/analytics/${installation.device_id}`);
          if (analyticsResponse.ok) {
            const rawRows = await analyticsResponse.json();
            if (Array.isArray(rawRows) && rawRows.length > 0) {
              telemetryRows = rawRows.map(row => ({
                timestamp: row.timestamp,
                power_w: (row.power ?? 0) * 1000,
                energy_kwh: (row.power ?? 0) * 0.08,
                temperature_c: row.temperature,
                irradiance_wm2: row.irradiance,
                voltage: row.voltage,
                current_a: row.current,
              }));
              fetchedFromNodeRed = true;
            }
          }
        } catch (err) {
          console.warn('Failed to fetch from Node-RED telemetry APIs, falling back to Supabase:', err.message);
        }
      }

      if (!fetchedFromNodeRed) {
        try {
          const telemetryWindow = new Date();
          telemetryWindow.setDate(telemetryWindow.getDate() - 90);
          telemetryRows = await supabaseFetch(`pv_data?select=timestamp,energy_kwh,temperature_c,irradiance_wm2,power_w&installation_id=eq.${encodeURIComponent(installation.id)}&timestamp=gte.${encodeURIComponent(telemetryWindow.toISOString())}&order=timestamp.asc`);
        } catch (sbErr) {
          console.warn('Supabase pv_data query failed:', sbErr.message);
        }
      }

      try {
        alerts = await supabaseFetch(`alerts?select=id,title,message,severity,is_resolved,triggered_at&installation_id=eq.${encodeURIComponent(installation.id)}&order=triggered_at.desc&limit=5`);
      } catch (alErr) {
        console.warn('Supabase alerts query failed:', alErr.message);
      }
    }

    if (profileId) {
      tickets = await supabaseFetch(`tickets?select=id,title,status,priority,created_at,assigned_to,installation_id&or=${encodeURIComponent(`(created_by.eq.${profileId},assigned_to.eq.${profileId})`)}&order=created_at.desc&limit=5`);
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - 6);
    const monthStart = new Date(todayStart);
    monthStart.setDate(todayStart.getDate() - 29);

    const parseTimestamp = (row) => {
      const value = row?.timestamp || row?.triggered_at || row?.created_at;
      return value ? new Date(value) : null;
    };

    const filterByRange = (rows, from) => rows.filter((row) => {
      const timestamp = parseTimestamp(row);
      return timestamp && timestamp >= from;
    });

    const todayRows = filterByRange(telemetryRows, todayStart);
    const weekRows = filterByRange(telemetryRows, weekStart);
    const monthRows = filterByRange(telemetryRows, monthStart);

    const latestTelemetry = telemetryRows.length ? telemetryRows[telemetryRows.length - 1] : null;
    const summaryLines = [];

    summaryLines.push('System summary for SolarWatch user:');
    if (profile) summaryLines.push(`- User: ${profile.full_name} (${profile.email})`);
    if (installation) {
      summaryLines.push(`- Installation: ${installation.name}`);
      summaryLines.push(`- Location: ${installation.address || 'Not provided'}`);
      summaryLines.push(`- Capacity: ${installation.capacity_kw ?? 'N/A'} kW`);
      summaryLines.push(`- Panels: ${installation.panel_count ?? 'N/A'}`);
      summaryLines.push(`- Inverter: ${installation.inverter_model || 'Unknown'}`);
      summaryLines.push(`- Status: ${installation.status}`);
      summaryLines.push(`- Device Link ID: ${installation.device_id || 'None'}`);
    }

    const currentPower = liveTelemetry ? (liveTelemetry.power ?? 0) : (latestTelemetry ? (latestTelemetry.power_w ?? 0) / 1000 : 0);
    const currentTemp = liveTelemetry ? (liveTelemetry.temperature ?? 0) : (latestTelemetry ? (latestTelemetry.temperature_c ?? 0) : 0);
    const currentIrr = liveTelemetry ? (liveTelemetry.irradiance ?? 0) : (latestTelemetry ? (latestTelemetry.irradiance_wm2 ?? 0) : 0);
    const currentEnergyToday = liveTelemetry ? (currentPower * 0.08) : (latestTelemetry ? (latestTelemetry.energy_kwh ?? 0) : 0);
    const currentVoltage = liveTelemetry ? (liveTelemetry.voltage ?? 0) : 0;
    const currentCurrent = liveTelemetry ? (liveTelemetry.current ?? 0) : 0;

    summaryLines.push('- Current Live Readings (as shown on Dashboard):');
    summaryLines.push(`  * Voltage: ${currentVoltage.toFixed(1)} V`);
    summaryLines.push(`  * Current: ${currentCurrent.toFixed(1)} A`);
    summaryLines.push(`  * Power: ${currentPower.toFixed(2)} kW`);
    summaryLines.push(`  * Temperature: ${currentTemp.toFixed(1)} °C`);
    summaryLines.push(`  * Irradiance: ${currentIrr.toFixed(0)} W/m²`);
    summaryLines.push(`  * Today's Energy: ${currentEnergyToday.toFixed(1)} kWh`);
    if (liveTelemetry) {
      summaryLines.push(`  * Last telemetry update: ${liveTelemetry.timestamp}`);
    }

    const totalToday = sum(todayRows.map((row) => row.energy_kwh));
    const avgTempToday = average(todayRows.map((row) => row.temperature_c));
    const avgIrrToday = average(todayRows.map((row) => row.irradiance_wm2));
    summaryLines.push(`- Today: ${totalToday.toFixed(1)} kWh produced, average temperature ${avgTempToday.toFixed(1)}°C, average irradiance ${avgIrrToday.toFixed(0)} W/m².`);

    const totalWeek = sum(weekRows.map((row) => row.energy_kwh));
    const avgIrrWeek = average(weekRows.map((row) => row.irradiance_wm2));
    summaryLines.push(`- Last 7 days: ${totalWeek.toFixed(1)} kWh produced, average irradiance ${avgIrrWeek.toFixed(0)} W/m².`);

    const totalMonth = sum(monthRows.map((row) => row.energy_kwh));
    summaryLines.push(`- Last 30 days: ${totalMonth.toFixed(1)} kWh produced.`);

    const unresolvedAlerts = alerts.filter((alert) => !alert.is_resolved);
    summaryLines.push(`- Active alerts: ${unresolvedAlerts.length}`);
    if (unresolvedAlerts.length) summaryLines.push(`- Recent alerts:\n${summarizeRecentRows(unresolvedAlerts, 'title')}`);

    const openTickets = tickets.filter((ticket) => ticket.status !== 'resolved' && ticket.status !== 'closed');
    summaryLines.push(`- Open tickets: ${openTickets.length}`);
    if (openTickets.length) summaryLines.push(`- Recent tickets:\n${summarizeRecentRows(openTickets, 'title')}`);

    const promptParts = [
      'SYSTEM: You are SolarWatch AI Assistant. Use the following user/system survey and telemetry summary to answer questions about the customer’s solar installation, production, maintenance, alerts, or ticket status. Do not invent system-specific details. If the data is insufficient, ask for clarifying information.',
      summaryLines.join('\n'),
    ];

    if (Array.isArray(history) && history.length) {
      promptParts.push('CONVERSATION HISTORY:');
      history.slice(-8).forEach((entry) => {
        promptParts.push(`${entry.role.toUpperCase()}: ${entry.content}`);
      });
    }

    promptParts.push(`USER QUESTION: ${message}`);
    const prompt = promptParts.join('\n\n');

    let answer = '';
    let showTicket = false;

    try {
      const grokJson = await queryGrok(prompt);
      answer = parseGrokText(grokJson).trim();
      if (!answer) {
        throw new Error('Grok returned an empty response');
      }
      showTicket = /ticket|support|technician|service|inspection/i.test(answer);
    } catch (grokError) {
      console.warn('AI Query failed, generating local fallback response', grokError);
      
      const lowerMsg = message.toLowerCase();
      const summary = {
        totalToday,
        totalWeek,
        avgTempToday,
        avgIrrToday,
        latestPower: latestTelemetry ? latestTelemetry.power_w : 0,
        activeAlerts: unresolvedAlerts.length,
      };

      if (lowerMsg.includes('production') || lowerMsg.includes('produit') || lowerMsg.includes('kwh') || lowerMsg.includes('génère')) {
        answer = `Sur la base de vos données récentes, votre système a produit un total d'environ **${summary.totalToday.toFixed(1)} kWh** aujourd'hui, et **${summary.totalWeek.toFixed(1)} kWh** sur les 7 derniers jours. La production est stable et conforme à l'ensoleillement récent.`;
      } else if (lowerMsg.includes('temp') || lowerMsg.includes('degré') || lowerMsg.includes('chaud')) {
        answer = `La température moyenne de vos panneaux aujourd'hui est de **${summary.avgTempToday.toFixed(1)}°C**. La température de fonctionnement est dans la plage optimale (optimal: 20-50°C).`;
      } else if (lowerMsg.includes('irradiance') || lowerMsg.includes('soleil') || lowerMsg.includes('rayon')) {
        answer = `L'irradiance moyenne mesurée aujourd'hui est de **${summary.avgIrrToday.toFixed(0)} W/m²**. C'est une valeur correcte qui permet d'assurer une bonne production photovoltaïque.`;
      } else if (lowerMsg.includes('alert') || lowerMsg.includes('problème') || lowerMsg.includes('erreur') || lowerMsg.includes('panne')) {
        answer = `Il y a actuellement **${summary.activeAlerts} alerte(s) active(s)** sur votre système. ${summary.activeAlerts > 0 ? "Veuillez vérifier l'onglet des alertes pour en savoir plus." : "Tout fonctionne normalement et aucun défaut n'a été détecté."}`;
      } else if (lowerMsg.includes('ticket') || lowerMsg.includes('support') || lowerMsg.includes('technicien')) {
        answer = `Vous pouvez créer un ticket d'assistance pour qu'un technicien intervienne sur votre système. Souhaitez-vous que je crée un ticket de support maintenant ?`;
        showTicket = true;
      } else {
        answer = `Bonjour ! Je suis votre assistant SolarWatch. Vos panneaux fonctionnent actuellement avec une puissance de **${summary.latestPower.toFixed(0)} W**. Je suis disponible pour répondre à vos questions sur votre production, la température de vos panneaux ou les alertes du système. N'hésitez pas à me demander des précisions.`;
      }
    }

    return res.json({ success: true, data: { text: answer, showTicket } });
  } catch (error) {
    console.error('Grok query failed completely', error);
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

function passwordResetHtml({ resetLink }) {
  return `
  <div style="font-family: Inter, Arial, sans-serif; color: #e6eef8; background: #0b1220; padding: 24px;">
    <div style="max-width:600px;margin:0 auto;background:#0f1724;border-radius:12px;padding:24px;border:1px solid #111827;">
      <h3 style="color:#f8f3ec;margin:0 0 8px;">Password Reset</h3>
      <p style="color:#9ca3af;margin:0 0 12px;">Click the button below to reset your password. This link will expire shortly.</p>
      <div style="text-align:center;margin-top:12px;"><a href="${resetLink}" style="background:#f59e0b;color:#0b1220;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;">Reset Password</a></div>
      <div style="margin-top:16px;font-size:12px;color:#6b7280;text-align:center;">SolarWatch</div>
    </div>
  </div>`;
}

app.post('/send-welcome-email', async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;
    if (!fullName || !email || !password || !role) return res.status(400).json({ success: false, error: 'Missing fields' });

    const html = welcomeHtml({ fullName, email, password, role });
    const { success, error } = await sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Welcome to SolarWatch, ${fullName}`,
      html,
    });

    if (!success) return res.status(500).json({ success: false, error });
    return res.json({ success: true });
  } catch (err) {
    console.error('send-welcome-email error', err);
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/send-ticket-update', async (req, res) => {
  try {
    const { email, ticketTitle, status, technicianMessage } = req.body;
    if (!email || !ticketTitle || !status) return res.status(400).json({ success: false, error: 'Missing fields' });

    const html = ticketUpdateHtml({ ticketTitle, status, technicianMessage: technicianMessage || '' });
    const { success, error } = await sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Update: ${ticketTitle} — ${status}`,
      html,
    });

    if (!success) return res.status(500).json({ success: false, error });
    return res.json({ success: true });
  } catch (err) {
    console.error('send-ticket-update error', err);
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/send-alert', async (req, res) => {
  try {
    const { email, alertType, alertMessage, severity } = req.body;
    if (!email || !alertType || !alertMessage) return res.status(400).json({ success: false, error: 'Missing fields' });

    const html = alertHtml({ alertType, alertMessage, severity: severity || 'info' });
    const { success, error } = await sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `${alertType} — ${severity || 'info'}`,
      html,
    });

    if (!success) return res.status(500).json({ success: false, error });
    return res.json({ success: true });
  } catch (err) {
    console.error('send-alert error', err);
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

async function generatePasswordResetLink(email) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase admin configuration for password reset link generation.');
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ type: 'recovery', email, redirect_to: PASSWORD_RESET_REDIRECT_URL }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error?.message || result?.error || `Supabase generate_link failed with status ${response.status}`);
  }

  const link =
    result?.data?.action_link ||
    result?.data?.properties?.action_link ||
    result?.action_link ||
    result?.data?.access_token;

  if (!link) {
    throw new Error('Failed to generate password reset link from Supabase.');
  }

  return link;
}

app.post('/send-password-reset', async (req, res) => {
  try {
    const { email, resetLink } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Missing email' });

    const link = resetLink || (await generatePasswordResetLink(email));
    const html = passwordResetHtml({ resetLink: link });
    const { success, error } = await sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `SolarWatch Password Reset`,
      html,
    });

    if (!success) return res.status(500).json({ success: false, error });
    return res.json({ success: true });
  } catch (err) {
    console.error('send-password-reset error', err);
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Mail server running on http://localhost:${PORT}`);
});
