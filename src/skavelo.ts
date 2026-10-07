import type {
  SkaveloCfg,
  UserContext,
  SkavelEvent,
  EventHandler,
  FeedbackRating,
  ShowPayload,
  AskResponse,
  DoPayload,
  RemoteConfig,
} from './types';
import { DEFAULT_API_URL, NetworkClient, Refused, StreamUnavailable } from './core/network';
import { runAction } from './core/actions';
import { takePendingUser } from './core/pending-user';
import { currentDevice, matchesTargeting, suggestionsFor, visitorBucket, watchUrl } from './core/targeting';
import { SessionStore } from './core/session';
import { scanPage } from './core/dom-scanner';
import { ShowMode } from './modes/show';
import { ShadowHost } from './ui/shadow-host';
import { HighlightOverlay } from './ui/highlight';
import { Widget } from './ui/widget';

/** What visitors see when a limit or the allowed sites check stops an answer. */
const UNAVAILABLE = "Help isn't available right now. Try again later.";

export class SkavelInstance {
  private cfg: SkaveloCfg;
  private net: NetworkClient;
  private session: SessionStore;
  private shadowHost: ShadowHost;
  private highlight: HighlightOverlay;
  private widget: Widget;
  private showMode: ShowMode | null = null;
  private inFlight: AbortController | null = null;
  private watched: { el: Element; type: string } | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private mutationObserver: MutationObserver | null = null;
  private frame = 0;
  private remote: RemoteConfig | null = null;
  private stopWatchingUrl: () => void;
  private bucket = visitorBucket();

  /** prefetched: settings already loaded (the one-snippet setup fetches every agent at once). */
  constructor(cfg: SkaveloCfg & { agentId: string }, prefetched?: RemoteConfig) {
    // A user is optional: with no id (signed out pages), conversations are simply anonymous.
    const user = cfg.user?.id ? cfg.user : takePendingUser() ?? undefined;
    this.cfg = { ...cfg, user };

    this.net = new NetworkClient(cfg.apiUrl ?? DEFAULT_API_URL, cfg.agentId);
    this.session = new SessionStore(cfg.agentId);

    this.shadowHost = new ShadowHost();
    const root = this.shadowHost.getRoot();

    this.highlight = new HighlightOverlay(root, cfg.theme?.accent);
    this.widget = new Widget(root, cfg.theme, {
      onAsk: (q) => this.runAsk(q),
      onStop: () => this.inFlight?.abort(),
      onOpen: () => this.emit({ type: 'open' }),
      onClose: () => this.emit({ type: 'close' }),
      onStepNext: () => this.advanceStep(),
      onStepBack: () => this.backStep(),
      onFeedback: (id, rating) => { this.feedback(id, rating).catch(() => {}); },
    });

    this.setupMutationObserver();
    this.restoreSession();
    this.stopWatchingUrl = watchUrl(() => this.applyTargeting());
    this.loadRemoteConfig(prefetched);
  }

  // Dashboard settings are the base; anything passed in code (cfg.theme) wins.
  private loadRemoteConfig(prefetched?: RemoteConfig) {
    this.widget.setReady(false);
    if (prefetched) {
      this.applyRemote(prefetched);
      return;
    }
    const controller = new AbortController();
    const giveUp = setTimeout(() => controller.abort(), 2500);
    this.net.config(controller.signal)
      .then((remote) => this.applyRemote(remote))
      .catch((err) => {
        // Not allowed on this site: stay out of sight instead of offering help that can't answer.
        if (err instanceof Refused && err.status === 403) {
          console.warn(`[Skavelo] ${err.message}`);
          this.widget.destroy();
          return;
        }
        this.widget.setReady(true);
      })
      .finally(() => clearTimeout(giveUp));
  }

  private applyRemote(remote: RemoteConfig) {
    this.remote = remote;
    this.widget.applyTheme({
      title: remote.name,
      ...remote.appearance,
      ...this.cfg.theme,
      branding: remote.branding,
    });
    this.applyTargeting();
    this.widget.setReady(true);
  }

  /**
   * Shows or hides the widget for this page and visitor, and picks this page's suggestions.
   * A walkthrough in progress stays visible even if it leads onto a page the rules leave out.
   */
  private applyTargeting() {
    if (!this.remote) return;
    const ctx = { path: location.pathname + location.hash, user: this.cfg.user, device: currentDevice(), bucket: this.bucket };
    const show = this.remote.available !== false && (!!this.showMode || matchesTargeting(this.remote.targeting, ctx));
    this.widget.setHidden(!show);
    this.widget.setSuggestions(suggestionsFor(this.remote.suggestions, ctx.path));
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Mid answer or mid walkthrough: the one-snippet setup won't swap agents under the visitor. */
  get busy(): boolean {
    return !!this.showMode || !!this.inFlight;
  }

  identify(user: UserContext): this {
    this.cfg = { ...this.cfg, user };
    const convId = this.session.getConversationId();
    if (convId) this.net.identify(convId, user).catch(() => {});
    // Signed in state and attributes can change who the widget is for.
    this.applyTargeting();
    return this;
  }

  open(): this {
    this.widget.open();
    return this;
  }

  close(): this {
    this.widget.close();
    return this;
  }

  async ask(question: string): Promise<void> {
    this.widget.showQuestion(question);
    await this.runAsk(question);
  }

  startWorkflow(workflowId: string): this {
    this.ask(`/run:${workflowId}`);
    return this;
  }

  on<T extends SkavelEvent['type']>(
    event: T,
    handler: EventHandler<Extract<SkavelEvent, { type: T }>>,
  ): this {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler as EventHandler);
    return this;
  }

  off<T extends SkavelEvent['type']>(
    event: T,
    handler: EventHandler<Extract<SkavelEvent, { type: T }>>,
  ): this {
    this.handlers.get(event)?.delete(handler as EventHandler);
    return this;
  }

  async feedback(messageId: string, rating: FeedbackRating, correction?: string): Promise<void> {
    await this.net.feedback({ messageId, rating, correction });
  }

  destroy(): void {
    this.stopWatchingUrl();
    this.unwatchTarget();
    cancelAnimationFrame(this.frame);
    this.mutationObserver?.disconnect();
    this.highlight.destroy();
    this.widget.destroy();
    this.shadowHost.destroy();
    // Let a later init() start fresh (React runs effects twice in development).
    const w = window as unknown as Record<string, unknown>;
    if (w[`_sk_${this.cfg.agentId}`] === this) delete w[`_sk_${this.cfg.agentId}`];
  }

  // ─── Asking ────────────────────────────────────────────────────────────────

  private async runAsk(question: string) {
    // A new question replaces any walkthrough in progress.
    if (this.showMode) this.endWalkthrough();

    const controller = new AbortController();
    this.inFlight = controller;

    const payload = {
      question,
      pageUrl: window.location.href,
      pageTitle: document.title,
      elements: scanPage(),
      conversationId: this.session.getConversationId(),
      // Who's asking, so even the first answer can fit their plan and role.
      ...(this.cfg.user?.id ? { user: this.cfg.user } : {}),
    };
    const stream = this.widget.beginStream();

    try {
      let res: AskResponse;
      try {
        res = await this.net.askStream(payload, { onText: (t) => stream.append(t) }, controller.signal);
      } catch (err) {
        // Old servers or proxies that can't stream: ask the normal way instead.
        if (!(err instanceof StreamUnavailable)) throw err;
        res = await this.net.ask(payload, controller.signal);
      }

      this.session.set({ conversationId: res.conversationId });
      this.widget.setLoading(false);

      if (res.mode === 'show' && res.show?.steps.length) {
        // Keep the intro above the walkthrough only if the server confirmed one; a streamed
        // placeholder like "none" is dropped.
        if (res.intro) stream.complete(res.intro, []);
        else stream.discard();
        this.startWalkthrough(res.show, { messageId: res.messageId });
      } else if (res.mode === 'do' && res.do?.request) {
        stream.discard();
        this.proposeAction(res.do, res.messageId);
      } else if (res.answer) {
        this.emit({ type: 'answer', messageId: res.messageId });
        stream.complete(res.answer.text, res.answer.sources ?? [], res.messageId);
      } else {
        stream.discard();
        this.widget.addMessage("I don't have an answer for that yet.", 'assistant');
      }
    } catch (err) {
      this.widget.setLoading(false);
      if (controller.signal.aborted) {
        // Whatever was written before Stop stays readable.
        if (stream.text) stream.settle();
        else stream.discard();
        this.widget.addMessage('Stopped.', 'assistant');
      } else if (err instanceof Refused) {
        stream.discard();
        this.widget.addMessage(UNAVAILABLE, 'assistant');
        console.warn(`[Skavelo] ${err.message}`);
      } else {
        stream.discard();
        this.widget.addMessage("That didn't go through. Try asking again.", 'assistant');
        console.error('[Skavelo]', err);
      }
    } finally {
      if (this.inFlight === controller) this.inFlight = null;
    }
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  /** Shows what would happen; runs only after the visitor approves, then tells Skavelo how it went. */
  private proposeAction(action: DoPayload, messageId: string) {
    const report = (outcome: 'approved' | 'rejected' | 'succeeded' | 'failed', detail?: string) =>
      this.net.skillResult({ messageId, outcome, detail }).catch(() => {});
    this.widget.addActionCard(
      action,
      async () => {
        this.emit({ type: 'do_approved', skillId: action.skillId });
        const result = await runAction(action, this.cfg.actions);
        report(result.ok ? 'succeeded' : 'failed', result.detail);
        return result;
      },
      () => {
        this.emit({ type: 'do_rejected', skillId: action.skillId });
        report('rejected');
      },
    );
  }

  // ─── Walkthroughs ──────────────────────────────────────────────────────────

  private startWalkthrough(payload: ShowPayload, opts: { messageId?: string; startAt?: number } = {}) {
    this.showMode = new ShowMode(payload, this.session, (e) => this.emit(e), opts);
    this.renderStep();
  }

  private renderStep() {
    if (!this.showMode) return;
    const view = this.showMode.resolve();
    if (!view) return;

    if (view.el) {
      this.highlight.point(view.el);
      this.watchTarget(view.el);
    } else {
      this.highlight.hide();
      this.unwatchTarget();
    }

    this.widget.showStep({
      title: this.showMode.title,
      instruction: view.instruction,
      stepIndex: view.stepIndex,
      total: view.total,
      found: !!view.el,
    });
  }

  private advanceStep() {
    if (!this.showMode) return;
    this.unwatchTarget();
    if (this.showMode.advance()) {
      this.renderStep();
    } else {
      this.finishWalkthrough();
    }
  }

  private backStep() {
    if (!this.showMode) return;
    this.showMode.back();
    this.renderStep();
  }

  private finishWalkthrough() {
    const messageId = this.showMode?.messageId;
    // The completion message stays put; targeting is checked again on the next page change.
    this.showMode = null;
    this.unwatchTarget();
    this.highlight.hide();
    this.widget.clearStep();
    this.widget.addCompletion("That's the last step. You're done.", messageId);
  }

  private endWalkthrough() {
    this.showMode?.abandon();
    this.showMode = null;
    this.applyTargeting();
    this.unwatchTarget();
    this.highlight.hide();
    this.widget.clearStep();
  }

  // Doing the highlighted thing counts as finishing the step. The step index is
  // saved right away so a click that triggers a full page load resumes on the next step.
  private onTargetDone = () => {
    if (!this.showMode) return;
    this.unwatchTarget();
    if (this.showMode.advance()) {
      setTimeout(() => this.renderStep(), 300);
    } else {
      this.finishWalkthrough();
    }
  };

  private watchTarget(el: Element) {
    if (this.watched?.el === el) return;
    this.unwatchTarget();
    const type = el.matches('input, select, textarea') ? 'change' : 'click';
    el.addEventListener(type, this.onTargetDone);
    this.watched = { el, type };
  }

  private unwatchTarget() {
    if (!this.watched) return;
    this.watched.el.removeEventListener(this.watched.type, this.onTargetDone);
    this.watched = null;
  }

  // ─── SPA changes ───────────────────────────────────────────────────────────

  private setupMutationObserver() {
    // document.body can be null when the script runs in <head>.
    this.mutationObserver = new MutationObserver(() => {
      if (!this.showMode) return;
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => this.renderStep());
    });
    this.mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style', 'aria-hidden', 'open'],
    });
  }

  private restoreSession() {
    const wt = this.session.getWalkthrough();
    if (wt) this.startWalkthrough(wt.payload, { messageId: wt.messageId, startAt: wt.stepIndex });
  }

  // ─── Event emitter ─────────────────────────────────────────────────────────

  private emit(event: SkavelEvent) {
    this.handlers.get(event.type)?.forEach((h) => {
      try { h(event); } catch {}
    });
  }
}
