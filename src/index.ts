import type { EventHandler, SkaveloCfg, SkavelEvent, UserContext } from './types';
import { SkavelInstance } from './skavelo';
import { setPendingUser } from './core/pending-user';
import { SiteRouter } from './site-router';

export type { SkaveloCfg, UserContext, ThemeCfg, HighlightStyle, HandoffReason, ActionsCfg, SkavelEvent, EventHandler, AskResponse, ResponseMode, DoPayload, LookPayload, LookupResult } from './types';
export { SkavelInstance, SiteRouter };

/** What Skavelo.init returns: one agent, a router over a workspace's agents, or a no-op on the server. */
export interface SkaveloWidget {
  identify(user: UserContext): unknown;
  open(): unknown;
  close(): unknown;
  ask(question: string): Promise<void>;
  /** Plays one of the agent's walkthroughs by its id, without asking the AI. */
  startWorkflow(workflowId: string, opts?: { intro?: boolean }): unknown;
  /** Something the user just did in your app, like "project_created"; offers set for it may show. */
  event(name: string): unknown;
  on<T extends SkavelEvent['type']>(event: T, handler: EventHandler<Extract<SkavelEvent, { type: T }>>): unknown;
  off<T extends SkavelEvent['type']>(event: T, handler: EventHandler<Extract<SkavelEvent, { type: T }>>): unknown;
  destroy(): void;
}

const serverStub: SkaveloWidget = {
  identify: () => serverStub,
  open: () => serverStub,
  close: () => serverStub,
  ask: async () => {},
  startWorkflow: () => serverStub,
  event: () => serverStub,
  on: () => serverStub,
  off: () => serverStub,
  destroy: () => {},
};
export { mountPreview } from './preview';
export type { PreviewView, PreviewOptions } from './preview';

/**
 * Skavelo SDK — the main entry point.
 *
 * @example
 * ```ts
 * import { Skavelo } from '@skavelo/sdk';
 *
 * const sk = Skavelo.init({
 *   agentId: 'agt_123',
 *   user: { id: hashedUserId, plan: 'growth' },
 *   theme: { accent: '#2F6BFF', position: 'bottom-right' },
 * });
 * ```
 */
export const Skavelo = {
  /**
   * Starts the widget. Pass agentId for one agent everywhere, or workspaceId to let each page
   * show the agent whose rules match it. Calling it again returns the same widget.
   */
  init(cfg: SkaveloCfg): SkaveloWidget {
    // On the server (Next.js, Nuxt, SvelteKit, Angular SSR) there's no page to show a widget on.
    // Doing nothing, rather than throwing, means a misplaced call can't break server rendering.
    if (typeof window === 'undefined' || typeof document === 'undefined') return serverStub;
    const w = window as any;
    if (cfg.workspaceId && !cfg.agentId) {
      const key = `_sk_ws_${cfg.workspaceId}`;
      if (w[key]) return w[key];
      const router = new SiteRouter({ ...cfg, workspaceId: cfg.workspaceId });
      w[key] = router;
      current = router;
      return router;
    }
    if (!cfg.agentId) throw new Error('[Skavelo] Pass agentId (or workspaceId) to Skavelo.init.');
    // Singleton per agentId: prevents duplicate widgets if init is called twice
    const existingKey = `_sk_${cfg.agentId}`;
    if (w[existingKey]) return w[existingKey];
    const instance = new SkavelInstance({ ...cfg, agentId: cfg.agentId });
    w[existingKey] = instance;
    current = instance;
    return instance;
  },

  /**
   * Tells Skavelo who's signed in, so their conversations show who asked. Call after login, or
   * whenever you know the user. Optional: without it the widget works the same, anonymously.
   * Safe to call before or after init.
   */
  identify(user: UserContext): void {
    setPendingUser(user);
    current?.identify(user);
  },
};

let current: SkaveloWidget | null = null;
