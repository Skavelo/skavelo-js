import type { ShowPayload } from '../types';

/**
 * Persists conversation and walkthrough state across page loads.
 *
 * The conversation is kept in localStorage, so other tabs and later visits carry on the same one
 * (and don't count as new conversations). It belongs to whoever was signed in when it was saved,
 * and is dropped after CONVERSATION_IDLE_MS, as the server does, so the next person on a shared
 * computer starts fresh.
 *
 * A walkthrough in progress stays in sessionStorage: it belongs to the tab it was started in.
 */

/** One key per agent, so a site with several agents keeps each one's conversation. */
const conversationKey = (agentId: string) => `_sk_conversation_${agentId}`;
const TAB_KEY = '_sk_session';
/** Matches the server's CONVERSATION_IDLE_MINUTES. */
export const CONVERSATION_IDLE_MS = 30 * 60 * 1000;

export interface SavedWalkthrough {
  payload: ShowPayload;
  stepIndex: number;
  /** The answer that started the walkthrough, rated when it finishes. */
  messageId?: string;
}

interface SavedConversation {
  agentId: string;
  id: string;
  /** Who was signed in; none for an anonymous conversation. */
  userId?: string;
  /** Last activity, in ms since the epoch. */
  at: number;
}

interface TabState {
  agentId: string;
  walkthrough?: SavedWalkthrough;
}

function read<T>(storage: () => Storage, key: string): T | null {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: unknown | null) {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked in private windows.
  }
}

const local = () => localStorage;
const tab = () => sessionStorage;

export class SessionStore {
  private agentId: string;
  private userId: () => string | undefined;

  /** userId: who's signed in now, read each time since identify() can change it. */
  constructor(agentId: string, userId: () => string | undefined = () => undefined) {
    this.agentId = agentId;
    this.userId = userId;
  }

  /**
   * The conversation to continue, if any: this agent's, not idle too long, and either anonymous
   * (a visitor who has since signed in carries it on) or the current user's.
   */
  getConversationId(): string | undefined {
    const saved = read<SavedConversation>(local, conversationKey(this.agentId));
    if (!saved || saved.agentId !== this.agentId) return undefined;
    if (Date.now() - saved.at > CONVERSATION_IDLE_MS || (saved.userId && saved.userId !== this.userId())) {
      write(local, conversationKey(this.agentId), null);
      return undefined;
    }
    return saved.id;
  }

  /** Saves the conversation after each answer, which also restarts its idle clock. */
  setConversationId(id: string) {
    write(local, conversationKey(this.agentId), { agentId: this.agentId, id, userId: this.userId(), at: Date.now() });
  }

  getWalkthrough(): SavedWalkthrough | null {
    const state = read<TabState>(tab, TAB_KEY);
    // Multiple agents can share an origin; only restore our own state.
    return state?.agentId === this.agentId ? state.walkthrough ?? null : null;
  }

  setWalkthrough(walkthrough: SavedWalkthrough | undefined) {
    write(tab, TAB_KEY, { agentId: this.agentId, walkthrough });
  }
}
