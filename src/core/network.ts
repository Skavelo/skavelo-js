import type { AskPayload, AskResponse, FeedbackPayload, RemoteConfig, UserContext } from '../types';

/** Where the widget talks to Skavelo unless `apiUrl` says otherwise. */
export const DEFAULT_API_URL = 'https://api.skavelo.com/api';

/** The widget's routes on the API. Breaking changes ship under a new version; this one keeps working. */
export const SDK_ROUTES = '/sdk/v1';

export class NetworkClient {
  private apiUrl: string;
  private agentId: string;
  private conversationId: string | null = null;
  private previewPass?: string;

  constructor(apiUrl: string, agentId: string, previewPass?: string) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.agentId = agentId;
    this.previewPass = previewPass;
  }

  /** Who's asking: the agent, plus the preview pass when the dashboard's bookmark started the widget. */
  private headers(): Record<string, string> {
    return { 'X-Agent-Id': this.agentId, ...(this.previewPass ? { 'X-Skavelo-Preview': this.previewPass } : {}) };
  }

  setConversationId(id: string) {
    this.conversationId = id;
  }

  async ask(payload: AskPayload, signal?: AbortSignal): Promise<AskResponse> {
    const res = await this.request<AskResponse>('POST', `${SDK_ROUTES}/ask`, payload, signal);
    this.conversationId = res.conversationId;
    return res;
  }

  /**
   * Streams the answer: onText gets the answer as it's written, the promise resolves with
   * the full response. Throws StreamUnavailable before anything is sent if streaming
   * isn't possible, so the caller can fall back to ask().
   */
  async askStream(
    payload: AskPayload,
    handlers: { onText: (text: string) => void },
    signal?: AbortSignal,
  ): Promise<AskResponse> {
    const res = await fetch(`${this.apiUrl}${SDK_ROUTES}/ask/stream`, {
      method: 'POST',
      signal,
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...this.headers() },
      body: JSON.stringify(payload),
    }).catch((err) => {
      if (signal?.aborted) throw err;
      throw new StreamUnavailable(String(err));
    });
    if (res.status === 401 || res.status === 403 || res.status === 429) throw await refusal(res);
    if (!res.ok || !res.body || !(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
      throw new StreamUnavailable(`status ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let split: number;
      while ((split = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const event = /^event: (.*)$/m.exec(frame)?.[1];
        const data = frame.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('\n');
        if (!event || !data) continue;
        const parsed = JSON.parse(data);
        if (event === 'meta') this.conversationId = parsed.conversationId;
        else if (event === 'delta') handlers.onText(parsed.text);
        else if (event === 'error') {
          if (parsed.status === 401 || parsed.status === 403 || parsed.status === 429) throw new Refused(parsed.message ?? 'Refused', parsed.status);
          throw new Error(parsed.message ?? 'Failed to process question');
        }
        else if (event === 'done') {
          this.conversationId = parsed.conversationId;
          return parsed as AskResponse;
        }
      }
    }
    throw new Error('The answer stream ended early');
  }

  config(signal?: AbortSignal): Promise<RemoteConfig> {
    return this.request<RemoteConfig>('GET', `${SDK_ROUTES}/config`, undefined, signal);
  }

  /** Asks the server to open its AI connections now, so the coming question doesn't wait for them. */
  warm(): void {
    this.request('POST', `${SDK_ROUTES}/warm`).catch(() => {});
  }

  async feedback(payload: FeedbackPayload): Promise<void> {
    await this.request('POST', `${SDK_ROUTES}/feedback`, payload);
  }

  async skillResult(payload: { messageId: string; outcome: 'approved' | 'rejected' | 'succeeded' | 'failed'; detail?: string }): Promise<void> {
    await this.request('POST', `${SDK_ROUTES}/skill-result`, payload);
  }

  async walkthroughResult(payload: { messageId: string; outcome: 'completed' | 'abandoned'; atStep?: number }): Promise<void> {
    await this.request('POST', `${SDK_ROUTES}/walkthrough-result`, payload);
  }

  async handoff(payload: { conversationId: string; reason: string; channel: string; email?: string; note?: string; pageUrl?: string }): Promise<void> {
    await this.request('POST', `${SDK_ROUTES}/handoff`, payload);
  }

  async identify(conversationId: string, user: UserContext): Promise<void> {
    await this.request('POST', `${SDK_ROUTES}/identify`, { conversationId, user });
  }

  private async request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    const res = await fetch(url, {
      method,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...this.headers(),
      },
      credentials: 'omit',
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 || res.status === 403 || res.status === 429) throw await refusal(res);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Skavelo API ${res.status}: ${text}`);
    }

    // Feedback and similar calls answer 204 with no body.
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }
}

/**
 * Skavelo said no on purpose: a usage limit, or this site isn't one of the agent's allowed sites.
 * The message is for the site's developer; visitors get a short, friendly line instead.
 */
export class Refused extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function refusal(res: Response): Promise<Refused> {
  const body = await res.json().catch(() => null) as { message?: string | string[] } | null;
  const message = Array.isArray(body?.message) ? body!.message[0] : body?.message;
  return new Refused(message ?? `Refused with status ${res.status}`, res.status);
}

/** Streaming isn't available (old server, proxy, browser); use the normal request instead. */
export class StreamUnavailable extends Error {}
