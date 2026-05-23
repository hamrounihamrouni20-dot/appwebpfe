const ASSISTANT_API_URL = import.meta.env.VITE_MAIL_SERVER_URL || 'http://localhost:5000';

interface AssistantRequest {
  profileId?: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface AssistantResponse {
  text: string;
  showTicket?: boolean;
}

async function postJson<T>(path: string, body: T) {
  const response = await fetch(`${ASSISTANT_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.raw || `HTTP ${response.status}`);
  }

  if (data && typeof data === 'object' && data.success === false) {
    throw new Error(data.error || 'Assistant request failed');
  }

  return data?.data ?? data;
}

export async function queryAssistant(message: string, profileId?: string, history?: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<AssistantResponse> {
  const result = await postJson<AssistantRequest>('/grok-query', { profileId, message, history });
  if (!result || typeof result.text !== 'string') {
    throw new Error('Invalid assistant response');
  }
  return { text: result.text, showTicket: result.showTicket };
}
