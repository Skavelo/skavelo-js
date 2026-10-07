import type { ShowPayload } from '../types';

/**
 * Persists conversation and walkthrough state across page loads.
 * Uses sessionStorage so state clears when the tab closes.
 */

const KEY = '_sk_session';

export interface SavedWalkthrough {
  payload: ShowPayload;
  stepIndex: number;
  /** The answer that started the walkthrough, rated when it finishes. */
  messageId?: string;
}

interface SessionState {
  agentId: string;
  conversationId?: string;
  walkthrough?: SavedWalkthrough;
}

export class SessionStore {
  private agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  get(): SessionState | null {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      const parsed: SessionState = JSON.parse(raw);
      // Multiple agents can share an origin; only restore our own state.
      return parsed.agentId === this.agentId ? parsed : null;
    } catch {
      return null;
    }
  }

  set(partial: Partial<Omit<SessionState, 'agentId'>>) {
    try {
      const current = this.get() ?? { agentId: this.agentId };
      sessionStorage.setItem(KEY, JSON.stringify({ ...current, ...partial, agentId: this.agentId }));
    } catch {
      // sessionStorage can be blocked in private windows.
    }
  }

  clear() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
  }

  getConversationId(): string | undefined {
    return this.get()?.conversationId;
  }

  getWalkthrough(): SavedWalkthrough | null {
    return this.get()?.walkthrough ?? null;
  }

  setWalkthrough(walkthrough: SavedWalkthrough | undefined) {
    this.set({ walkthrough });
  }
}
