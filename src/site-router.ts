import type { EventHandler, RemoteConfig, SkavelEvent, SkaveloCfg, UserContext } from './types';
import { SkavelInstance } from './skavelo';
import { currentDevice, pickAgent, visitorBucket, watchUrl } from './core/targeting';
import { takePendingUser } from './core/pending-user';
import { DEFAULT_API_URL, SDK_ROUTES } from './core/network';

/**
 * One snippet for a workspace with several agents: loads them all once, then shows the agent whose
 * rules match the current page, switching as the visitor moves around. A conversation or
 * walkthrough in progress keeps its agent until it's done.
 */
export class SiteRouter {
  private agents: RemoteConfig[] = [];
  private current: SkavelInstance | null = null;
  private currentId: string | null = null;
  private user: UserContext | undefined;
  private handlers: [string, EventHandler][] = [];
  private stopWatching: () => void = () => {};
  private bucket = visitorBucket();
  private destroyed = false;

  constructor(private cfg: SkaveloCfg & { workspaceId: string }) {
    this.user = cfg.user?.id ? cfg.user : takePendingUser() ?? undefined;
    this.load();
  }

  private async load() {
    const apiUrl = (this.cfg.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, '');
    try {
      const res = await fetch(`${apiUrl}${SDK_ROUTES}/site`, {
        headers: { 'X-Workspace-Id': this.cfg.workspaceId },
        credentials: 'omit',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        console.warn(`[Skavelo] ${body?.message ?? `Couldn't load agents (${res.status})`}`);
        return;
      }
      this.agents = body?.agents ?? [];
    } catch (err) {
      console.warn('[Skavelo] Couldn\'t load agents', err);
      return;
    }
    if (this.destroyed) return;
    this.stopWatching = watchUrl(() => this.route());
    this.route();
  }

  /** Shows the right agent for this page, or none. */
  private route() {
    if (this.destroyed) return;
    if (this.current?.busy) return;
    const picked = pickAgent(this.agents, {
      path: location.pathname + location.hash, user: this.user, device: currentDevice(), bucket: this.bucket,
    });
    if ((picked?.id ?? null) === this.currentId) return;
    this.current?.destroy();
    this.current = null;
    this.currentId = picked?.id ?? null;
    if (!picked) return;
    const instance = new SkavelInstance({ ...this.cfg, agentId: picked.id, user: this.user }, picked);
    for (const [event, handler] of this.handlers) instance.on(event as SkavelEvent['type'], handler as never);
    this.current = instance;
  }

  identify(user: UserContext): this {
    this.user = user;
    this.current?.identify(user);
    this.route();
    return this;
  }

  open(): this { this.current?.open(); return this; }
  close(): this { this.current?.close(); return this; }
  async ask(question: string): Promise<void> { await this.current?.ask(question); }

  on<T extends SkavelEvent['type']>(event: T, handler: EventHandler<Extract<SkavelEvent, { type: T }>>): this {
    this.handlers.push([event, handler as EventHandler]);
    this.current?.on(event, handler);
    return this;
  }

  off<T extends SkavelEvent['type']>(event: T, handler: EventHandler<Extract<SkavelEvent, { type: T }>>): this {
    this.handlers = this.handlers.filter(([e, h]) => !(e === event && h === handler));
    this.current?.off(event, handler);
    return this;
  }

  destroy(): void {
    this.destroyed = true;
    this.stopWatching();
    this.current?.destroy();
    this.current = null;
    const w = window as unknown as Record<string, unknown>;
    if (w[`_sk_ws_${this.cfg.workspaceId}`] === this) delete w[`_sk_ws_${this.cfg.workspaceId}`];
  }
}
