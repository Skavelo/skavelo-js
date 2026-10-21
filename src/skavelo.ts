import type {
  SkaveloCfg,
  UserContext,
  SkavelEvent,
  EventHandler,
  FeedbackRating,
  ShowPayload,
  AskResponse,
  LookupResult,
  DoPayload,
  RemoteConfig,
  HandoffReason,
  WalkthroughOffer,
} from './types';
import { DEFAULT_API_URL, NetworkClient, Refused, StreamUnavailable } from './core/network';
import { runAction, runLookup } from './core/actions';
import { canClickFor, checkThen, fillField } from './core/fill';
import { StuckWatcher, helpFor, type StuckSignal } from './core/stuck';
import { takePendingUser } from './core/pending-user';
import { currentDevice, matchesTargeting, suggestionsFor, visitorBucket, watchUrl, type VisitContext } from './core/targeting';
import {
  answeredOffers, markOfferedThisVisit, offerFor, offeredThisVisit, offerVisitorKey, rememberOffer, typingInApp,
} from './core/offers';
import { SessionStore } from './core/session';
import { scanPage } from './core/dom-scanner';
import { ShowMode } from './modes/show';
import { ShadowHost } from './ui/shadow-host';
import { HighlightOverlay } from './ui/highlight';
import { Widget, type HandoffOffer } from './ui/widget';
import { findChatTool, openChatTool } from './core/chat-tools';
import { collectPageSignals, watchRequests } from './core/signals';

/** What visitors see when a limit or the allowed sites check stops an answer. */
const UNAVAILABLE = "Help isn't available right now. Please try again later.";

/** "Can I talk to someone?" and the like, as opposed to a question Skavelo couldn't answer. */
const ASKED_FOR_PERSON = /\b(human|person|someone|somebody|agent|support|representative|rep|real people|talk to|speak (to|with)|contact)\b/i;

/** The first message a person on the team sees. */
function handoffSummary(question: string | undefined, pageTitle: string, diagnosis?: string): string {
  const page = pageTitle.trim() ? ` on "${pageTitle.trim()}"` : '';
  const asked = question
    ? `Hello, I was using the help assistant${page} and need help with: ${question}`
    : `Hello, I need help with something${page}.`;
  return diagnosis ? `${asked}\n\n${diagnosisNote(diagnosis)}` : asked;
}

/**
 * The diagnosis as one line for your team. The server writes it as "Checked: …. Likely cause: …",
 * so the label takes the place of its "Checked:" instead of repeating it.
 */
export function diagnosisNote(diagnosis: string): string {
  const checked = diagnosis.replace(/^checked:\s*/i, '');
  return checked === diagnosis ? `From the assistant: ${diagnosis}` : `The assistant checked: ${checked}`;
}

/** The page's signals, left out when there's nothing to report or reading them fails. */
function pageSignalsOrNothing() {
  try {
    const signals = collectPageSignals();
    return Object.keys(signals).length ? { pageSignals: signals } : {};
  } catch {
    return {};
  }
}

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
  /** The visitor's last question, for the message a person on the team sees first. */
  private lastQuestion = '';
  /** What Skavelo found for the last reported problem, passed on to the team. */
  private lastDiagnosis: string | undefined;
  private remote: RemoteConfig | null = null;
  private stopWatchingUrl: () => void;
  private leadTimer = 0;
  private bucket = visitorBucket();

  /** prefetched: settings already loaded (the one-snippet setup fetches every agent at once). */
  constructor(cfg: SkaveloCfg & { agentId: string }, prefetched?: RemoteConfig) {
    // A user is optional: with no id (signed out pages), conversations are simply anonymous.
    const user = cfg.user?.id ? cfg.user : takePendingUser() ?? undefined;
    this.cfg = { ...cfg, user };

    this.net = new NetworkClient(cfg.apiUrl ?? DEFAULT_API_URL, cfg.agentId, cfg.previewPass);
    if (cfg.diagnostics?.network !== false) watchRequests(cfg.apiUrl ?? DEFAULT_API_URL);
    this.session = new SessionStore(cfg.agentId, () => this.cfg.user?.id);

    this.shadowHost = new ShadowHost();
    const root = this.shadowHost.getRoot();

    this.highlight = new HighlightOverlay(root, cfg.theme?.accent);
    this.highlight.setTheme({ accent: cfg.theme?.accent, highlight: cfg.theme?.highlight });
    this.widget = new Widget(root, cfg.theme, {
      onAsk: (q, suggestionId) => this.runAsk(q, suggestionId),
      onStop: () => this.inFlight?.abort(),
      onOpen: () => {
        this.warm();
        this.emit({ type: 'open' });
      },
      onIntent: () => this.warm(),
      onClose: () => {
        // Closing the widget mid-walkthrough means the user is done with it. Leaving it running
        // would reopen the widget on the next page change, such as clicking into a field.
        if (this.showMode) this.endWalkthrough();
        this.emit({ type: 'close' });
      },
      onStepNext: () => this.advanceStep(),
      onStepBack: () => this.backStep(),
      onFeedback: (id, rating) => {
        this.feedback(id, rating).catch(() => {});
        // An unhelpful answer is the moment to offer a person.
        if (rating === -1) this.offerHandoff(id, 'unhelpful');
      },
    });

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
        // Not allowed on this site, or the agent no longer exists (deleted, or a mistyped ID):
        // stay out of sight instead of offering help that can't answer.
        if (err instanceof Refused && (err.status === 401 || err.status === 403)) {
          console.warn(err.status === 401
            ? `[Skavelo] No agent with ID ${this.cfg.agentId}. It may have been deleted; check the ID on the agent's Install page, or remove the snippet.`
            : `[Skavelo] ${err.message}`);
          this.destroy();
          return;
        }
        this.widget.setReady(true);
      })
      .finally(() => clearTimeout(giveUp));
  }

  private stuck: StuckWatcher | null = null;
  private lastNudge = 0;

  /** Watches for a visitor who seems stuck, unless the agent has it switched off. */
  private watchForStuck() {
    if (this.remote?.stuckHelp === false || this.stuck || typeof MutationObserver === 'undefined') return;
    this.stuck = new StuckWatcher((signal) => this.offerHelp(signal));
    // Nobody is stuck in the first moments, so it starts once the page has settled.
    const stuck = this.stuck;
    const start = () => { if (this.stuck === stuck) stuck.start(); };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 3000 });
    else setTimeout(start, 1500);
  }

  /**
   * Offers help for a stuck visitor: at most once every two minutes, three times a visit, and
   * never twice for the same thing, nor while a walkthrough or answer is under way.
   */
  private offerHelp(signal: StuckSignal) {
    if (this.showMode || this.inFlight || Date.now() - this.lastNudge < 120_000) return;
    const { chip, question } = helpFor(signal);
    const key = `${signal.kind}:${'label' in signal ? signal.label : signal.text}`;
    let seen: string[] = [];
    try { seen = JSON.parse(sessionStorage.getItem('_sk_stuck') ?? '[]'); } catch {}
    if (seen.length >= 3 || seen.includes(key)) return;
    const shown = this.widget.nudge(
      chip,
      () => {
        this.emit({ type: 'stuck', kind: signal.kind, question, accepted: true });
        this.widget.showQuestion(question);
        void this.runAsk(question);
      },
      () => this.emit({ type: 'stuck', kind: signal.kind, question, accepted: false }),
    );
    if (!shown) return;
    this.lastNudge = Date.now();
    try { sessionStorage.setItem('_sk_stuck', JSON.stringify([...seen, key])); } catch {}
    this.emit({ type: 'stuck', kind: signal.kind, question });
  }

  private applyRemote(remote: RemoteConfig) {
    this.remote = remote;
    this.watchForStuck();
    const theme = { ...remote.appearance, ...this.cfg.theme };
    this.widget.applyTheme({ title: remote.name, ...theme, branding: remote.branding });
    // The dashboard's accent and style reach the highlight too, not only what's set in code.
    this.highlight.setTheme({ accent: theme.accent, highlight: theme.highlight ?? 'beacon' });
    this.applyTargeting();
    this.widget.setReady(true);
  }

  /**
   * Shows or hides the widget for this page and visitor, and picks this page's suggestions.
   * A walkthrough in progress stays visible even if it leads onto a page the rules leave out.
   */
  private applyTargeting() {
    if (!this.remote) return;
    const ctx = this.visit();
    const show = this.remote.available !== false && (!!this.showMode || matchesTargeting(this.remote.targeting, ctx));
    this.widget.setHidden(!show);
    this.widget.setSuggestions(suggestionsFor(this.remote.suggestions, ctx));
    if (show) this.considerOffer();
  }

  private visit(): VisitContext {
    return { path: location.pathname + location.hash, user: this.cfg.user, device: currentDevice(), bucket: this.bucket, origin: location.origin };
  }

  // ─── Walkthrough offers ────────────────────────────────────────────────────

  private offerTimer = 0;
  /** The offer whose walkthrough is running, so finishing it can be reported. */
  private offerRun: { offerId: string; workflowId: string } | null = null;

  /**
   * Looks for a walkthrough offer that fits this page (or the event the app just reported) and
   * shows it after its delay. One offer a visit, never over an answer, a walkthrough, stuck help
   * or someone typing, and never one this visitor already answered.
   */
  private considerOffer(event?: string, tries = 0) {
    if (!this.remote?.offers?.length || offeredThisVisit()) return;
    const offer = offerFor(this.remote.offers, this.visit(), { event, answered: answeredOffers() });
    if (!offer) return;
    clearTimeout(this.offerTimer);
    const delay = tries ? 4000 : Math.max(0, offer.delaySeconds) * 1000;
    this.offerTimer = window.setTimeout(() => {
      // The visitor may have moved on, or be in the middle of something.
      if (offeredThisVisit() || this.widget.nudging || this.showMode || this.inFlight) return;
      if (offerFor(this.remote?.offers, this.visit(), { event, answered: answeredOffers() })?.id !== offer.id) return;
      if (typingInApp()) {
        if (tries < 5) this.considerOffer(event, tries + 1);
        return;
      }
      void this.showOffer(offer);
    }, delay);
  }

  private async showOffer(offer: WalkthroughOffer) {
    const key = offerVisitorKey(this.cfg.user?.id);
    let show = false;
    try {
      ({ show } = await this.net.offerShown(offer.id, key));
    } catch {
      return;
    }
    // Answered on another device, or shown enough times already.
    if (!show) {
      rememberOffer(offer.id, 'dismissed');
      return;
    }
    if (this.showMode || this.inFlight || this.widget.nudging) return;
    const shown = this.widget.nudge(
      offer.message,
      () => {
        rememberOffer(offer.id, 'accepted');
        this.net.offerResult(offer.id, key, 'accepted').catch(() => {});
        this.emit({ type: 'offer', offerId: offer.id, workflowId: offer.workflowId, action: 'accepted' });
        this.offerRun = { offerId: offer.id, workflowId: offer.workflowId };
        void this.playWalkthrough(offer.workflowId, { intro: true, source: 'offer' }).then((started) => {
          if (!started) this.offerRun = null;
        });
      },
      () => {
        rememberOffer(offer.id, 'dismissed');
        this.net.offerResult(offer.id, key, 'dismissed').catch(() => {});
        this.emit({ type: 'offer', offerId: offer.id, workflowId: offer.workflowId, action: 'dismissed' });
      },
    );
    if (!shown) return;
    // Stuck help can still take its place: someone stuck needs help more than a tour.
    markOfferedThisVisit();
    this.emit({ type: 'offer', offerId: offer.id, workflowId: offer.workflowId, action: 'shown' });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Mid answer or mid walkthrough: the one-snippet setup won't swap agents under the visitor. */
  get busy(): boolean {
    return !!this.showMode || !!this.inFlight;
  }

  /**
   * Tells Skavelo something the user just did in your app, like event('project_created'). A
   * walkthrough offer set up for that event may show. Nothing is sent or stored.
   */
  event(name: string): this {
    this.considerOffer(name);
    return this;
  }

  identify(user: UserContext): this {
    this.cfg = { ...this.cfg, user };
    // Only an anonymous conversation, or this user's own, is still returned here.
    const convId = this.session.getConversationId();
    if (convId) {
      this.net.identify(convId, user).catch(() => {});
      this.session.setConversationId(convId);
    }
    // Signed in state and attributes can change who the widget is for.
    this.applyTargeting();
    return this;
  }

  private lastWarm = 0;

  /** The server's connections close after a minute idle; reopen them once the visitor looks ready to ask. */
  private warm() {
    if (Date.now() - this.lastWarm < 40_000) return;
    this.lastWarm = Date.now();
    this.net.warm();
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

  /**
   * Plays one of the agent's walkthroughs, by its id from the dashboard, without asking the AI, so
   * it costs no conversation. An introduction with its name, what it does and Start comes first,
   * unless intro is false (for your own "Show me how" button, say).
   */
  startWorkflow(workflowId: string, opts: { intro?: boolean } = {}): this {
    void this.playWalkthrough(workflowId, { intro: opts.intro !== false, source: 'code' });
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
    this.stuck?.stop();
    clearTimeout(this.offerTimer);
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

  /**
   * Asks and shows the reply. When Skavelo first needs the visitor's own data, it runs that lookup
   * here, in their browser, and asks again with the result (lookup set), keeping the same Stop.
   */
  private async runAsk(question: string, suggestionId?: string, lookup?: LookupResult, reuse?: AbortController) {
    // A new question replaces any walkthrough in progress.
    if (this.showMode) this.endWalkthrough();

    const controller = reuse ?? new AbortController();
    this.inFlight = controller;
    this.lastQuestion = question;
    if (!lookup) this.lastDiagnosis = undefined;
    if (lookup) this.widget.setLoading(true);

    const payload = {
      question,
      pageUrl: window.location.href,
      pageTitle: document.title,
      elements: scanPage(),
      conversationId: this.session.getConversationId(),
      // Who's asking, so even the first answer can fit their plan and role.
      ...(this.cfg.user?.id ? { user: this.cfg.user } : {}),
      ...(suggestionId ? { suggestionId } : {}),
      // Lets Skavelo mention the "Talk to a person" button only where it can actually show.
      ...(this.handoffRoute() ? { canHandoff: true } : {}),
      ...(lookup ? { lookup } : {}),
      ...pageSignalsOrNothing(),
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

      this.session.setConversationId(res.conversationId);
      this.widget.setLoading(false);
      if (res.diagnosis) this.lastDiagnosis = res.diagnosis;

      if (res.mode === 'show' && res.show?.steps.length) {
        // Keep the intro above the walkthrough only if the server confirmed one; a streamed
        // placeholder like "none" is dropped.
        if (res.intro) stream.complete(res.intro, []);
        else stream.discard();
        this.emit({ type: 'walkthrough_start', workflowId: res.show.workflowId, source: 'asked' });
        this.startWalkthrough(res.show, { messageId: res.messageId });
      } else if (res.mode === 'look' && res.look?.request && !lookup) {
        stream.status(res.intro ?? `Checking ${res.look.skillName}.`);
        this.widget.setLoading(true);
        const result = await runLookup(res.look, this.cfg.actions, controller.signal);
        this.emit({ type: 'lookup', skillId: res.look.skillId, ok: result.status >= 200 && result.status < 400 });
        if (controller.signal.aborted) throw new DOMException('Stopped', 'AbortError');
        await this.runAsk(question, suggestionId, { messageId: res.messageId, ...result }, controller);
        return;
      } else if (res.mode === 'do' && res.do?.request) {
        stream.discard();
        this.proposeAction(res.do, res.messageId);
      } else if (res.answer) {
        this.emit({ type: 'answer', messageId: res.messageId });
        stream.complete(res.answer.text, res.answer.sources ?? [], res.messageId);
        if (res.handoff) this.offerHandoff(res.messageId, ASKED_FOR_PERSON.test(question) ? 'asked' : 'no_answer');
      } else {
        stream.discard();
        this.widget.addMessage("I don't have an answer to that question yet.", 'assistant');
        this.offerHandoff(null, 'no_answer');
      }
    } catch (err) {
      this.widget.setLoading(false);
      if (controller.signal.aborted) {
        // Whatever was written before Stop stays readable.
        if (stream.text) stream.settle();
        else stream.discard();
        this.widget.addMessage('Response stopped.', 'assistant');
      } else if (err instanceof Refused) {
        stream.discard();
        this.widget.addMessage(this.cfg.showLimitReasons && err.message ? err.message : UNAVAILABLE, 'assistant');
        console.warn(`[Skavelo] ${err.message}`);
      } else {
        stream.discard();
        this.widget.addMessage('Something went wrong. Please try asking again.', 'assistant');
        console.error('[Skavelo]', err);
      }
    } finally {
      if (this.inFlight === controller) this.inFlight = null;
    }
  }

  // ─── Handoff ───────────────────────────────────────────────────────────────

  /**
   * How a person can be reached from this page right now: the support chat on the page, email,
   * or the site's own code. Null when handoff is off or nothing would work here.
   */
  private handoffRoute(): 'chat' | 'email' | 'code' | null {
    const h = this.remote?.handoff;
    if (!h) return null;
    if (h.method === 'code') return 'code';
    if (h.method === 'email') return h.email ? 'email' : null;
    return findChatTool() ? 'chat' : h.email ? 'email' : null;
  }

  private offerHandoff(messageId: string | null, reason: HandoffReason) {
    if (!this.handoffRoute()) return;
    this.widget.offerHandoff(messageId, (offer) => this.startHandoff(reason, offer));
  }

  /**
   * Runs from the click itself: copying to the clipboard and opening another chat both need a
   * fresh user action, so nothing here waits before them.
   */
  private startHandoff(reason: HandoffReason, offer: HandoffOffer) {
    const conversationId = this.session.getConversationId();
    const route = this.handoffRoute();
    if (!conversationId || !route) {
      offer.done("The team isn't available from this page right now.");
      return;
    }
    const pageUrl = window.location.href;
    const question = this.lastQuestion || undefined;
    const diagnosis = this.lastDiagnosis;
    const summary = handoffSummary(question, document.title, diagnosis);
    const report = (channel: string, extra: { email?: string; note?: string } = {}) =>
      this.net.handoff({ conversationId, reason, channel, pageUrl, ...extra });
    const fire = (channel: string) =>
      this.emit({ type: 'handoff', conversationId, reason, channel, summary, question, ...(diagnosis ? { diagnosis } : {}), pageUrl });

    if (route === 'chat') {
      const tool = findChatTool();
      if (tool) {
        // Tools that can't take a message get it on the clipboard instead, ready to paste.
        if (tool.delivers === 'none') navigator.clipboard?.writeText(summary).catch(() => {});
        if (openChatTool(tool, summary)) {
          const channel = `chat:${tool.id}`;
          report(channel).catch(() => {});
          fire(channel);
          offer.done({
            prefill: `${tool.name} is open with your question ready to send.`,
            send: `Your question was sent to the team in ${tool.name}.`,
            none: `${tool.name} is open. Your question has been copied so you can paste it there.`,
          }[tool.delivers]);
          this.widget.close();
          return;
        }
      }
      // The chat didn't open; email is next if the team set it up.
      if (!this.remote?.handoff?.email) {
        offer.done("The chat couldn't be opened. Please use the support link on this page instead.");
        return;
      }
    }

    if (route === 'code') {
      report('code').catch(() => {});
      fire('code');
      offer.done('Your request has been passed to the team.');
      return;
    }

    const known = typeof this.cfg.user?.email === 'string' ? this.cfg.user.email : undefined;
    offer.askEmail(known, async (email, note) => {
      try {
        await report('email', { email, ...(note ? { note } : {}) });
        fire('email');
        return null;
      } catch (err) {
        if (err instanceof Refused && err.status === 429) return 'Too many requests. Please try again in a few minutes.';
        return "Your message couldn't be sent. Please try again.";
      }
    });
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

  /** While a replay runs: the completion message it was started from. */
  private replayOf: HTMLElement | null = null;

  /** With fill: the step Skavelo is about to do for the visitor, so it's done once. */
  private autoStep = -1;
  private autoTimer = 0;
  /** Set when the visitor steps back during a fill: from then on they're doing it themselves. */
  private autoPaused = false;

  /**
   * Fetches a saved walkthrough and plays it, after an introduction when intro is set. Resolves to
   * true once the visitor starts it, false if they chose Not now or it couldn't be loaded.
   */
  private async playWalkthrough(
    workflowId: string,
    opts: { intro: boolean; source: 'code' | 'offer' },
  ): Promise<boolean> {
    let payload: ShowPayload;
    try {
      payload = await this.net.walkthrough(workflowId);
    } catch (err) {
      console.warn(`[Skavelo] The walkthrough ${workflowId} couldn't be loaded.`, err);
      return false;
    }
    if (!payload.steps?.length) return false;
    const begin = () => {
      if (this.showMode) this.endWalkthrough();
      this.emit({ type: 'walkthrough_start', workflowId: payload.workflowId, source: opts.source });
      this.startWalkthrough(payload);
    };
    if (!opts.intro) {
      begin();
      return true;
    }
    return new Promise((settle) => {
      this.widget.showIntro(
        { name: payload.name ?? 'Walkthrough', description: payload.description, total: payload.steps.length },
        (start) => {
          if (start) begin();
          settle(start);
        },
      );
    });
  }

  private startWalkthrough(payload: ShowPayload, opts: { messageId?: string; startAt?: number } = {}) {
    this.showMode = new ShowMode(payload, this.session, (e) => this.emit(e), opts);
    this.watchPage(true);
    this.autoStep = -1;
    this.autoPaused = false;
    this.renderStep();
  }

  private renderStep() {
    if (!this.showMode) return;
    const view = this.showMode.resolve();
    if (!view) return;

    if (view.el) {
      this.highlight.point(view.el);
      // A link to the step's page doesn't finish the step; the page it opens shows the step again.
      if (view.bridge) this.unwatchTarget();
      else this.watchTarget(view.el);
    } else {
      this.highlight.hide();
      this.unwatchTarget();
      // The control may be behind something an earlier step opens; look again once the wait is over.
      const wait = this.showMode.msUntilLead();
      if (wait > 0) {
        clearTimeout(this.leadTimer);
        this.leadTimer = window.setTimeout(() => this.renderStep(), wait + 50);
      }
    }

    const filling = !!this.showMode.payload.fill && !this.autoPaused;
    const last = view.stepIndex === view.total - 1;
    this.widget.showStep({
      title: this.showMode.title,
      instruction: filling && last ? checkThen(view.instruction) : view.instruction,
      heading: view.heading,
      details: view.details,
      stepIndex: view.stepIndex,
      total: view.total,
      found: !!view.el,
      anchor: view.el,
      pending: !view.el && this.showMode.msUntilLead() > 0,
    });
    if (filling && view.el) this.doStepFor(view.el, view.stepIndex, last);
  }

  /**
   * Does the current step for the visitor, after a moment so they can see what's happening:
   * enters its value, or makes a click that only moves or opens something. Doing it fires the
   * same change or click the visitor would, so the walkthrough moves on as usual. The last step,
   * and anything that saves, sends or deletes, waits for the visitor.
   */
  private doStepFor(el: Element, stepIndex: number, last: boolean) {
    if (this.autoStep === stepIndex || last) return;
    const step = this.showMode?.currentStep();
    if (!step) return;
    const isField = el.matches('input, select, textarea');
    if (isField ? step.value === undefined : !canClickFor(el)) return;
    this.autoStep = stepIndex;
    clearTimeout(this.autoTimer);
    this.autoTimer = window.setTimeout(() => {
      // Only if nothing moved on in the meantime.
      if (!this.showMode || this.autoPaused || this.showMode.currentStep() !== step || !el.isConnected) return;
      if (isField) {
        // A field it can't fill (a custom dropdown, an option that isn't there) is left for the visitor.
        fillField(el, step.value!);
      } else {
        (el as HTMLElement).click();
      }
    }, isField ? 450 : 650);
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
    clearTimeout(this.autoTimer);
    this.autoPaused = true;
    this.showMode.back();
    this.renderStep();
  }

  private finishWalkthrough() {
    const payload = this.showMode?.payload;
    const messageId = this.showMode?.messageId;
    // Replays have no message id, so only the first run is counted.
    if (messageId) this.net.walkthroughResult({ messageId, outcome: 'completed' }).catch(() => {});
    if (this.offerRun && payload?.workflowId === this.offerRun.workflowId) {
      this.net.offerResult(this.offerRun.offerId, offerVisitorKey(this.cfg.user?.id), 'completed').catch(() => {});
    }
    this.offerRun = null;
    const replayOf = this.replayOf;
    this.replayOf = null;
    // The completion message stays put; targeting is checked again on the next page change.
    this.showMode = null;
    this.watchPage(false);
    this.unwatchTarget();
    this.highlight.hide();
    this.widget.clearStep();
    // The last step may have been beside its control with the panel down; the ending shows in the panel.
    this.widget.showView('panel', false);
    // A replay ends on the message it was started from rather than adding another one.
    if (replayOf?.isConnected) {
      this.widget.revisit(replayOf);
      return;
    }
    const msg: HTMLElement = this.widget.addCompletion(
      "That was the last step. You've completed the walkthrough.",
      messageId,
      // The steps are already here, so going through them again needs no question and no answer.
      payload ? () => this.replayWalkthrough(payload, msg) : undefined,
    );
  }

  private replayWalkthrough(payload: ShowPayload, from: HTMLElement) {
    // Another walkthrough may be running by now; this one takes its place.
    if (this.showMode) this.endWalkthrough();
    this.emit({ type: 'walkthrough_replay', workflowId: payload.workflowId });
    this.replayOf = from;
    // No message id: the walkthrough was rated the first time, so the replay doesn't ask again.
    this.startWalkthrough(payload);
  }

  private endWalkthrough() {
    clearTimeout(this.autoTimer);
    this.offerRun = null;
    this.replayOf = null;
    const messageId = this.showMode?.messageId;
    const atStep = this.showMode?.stepIndexNow;
    if (messageId) this.net.walkthroughResult({ messageId, outcome: 'abandoned', atStep }).catch(() => {});
    this.showMode?.abandon();
    this.showMode = null;
    this.watchPage(false);
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

  /**
   * Follows the page while a walkthrough runs, so the highlight moves when the page changes.
   * Only then: on a busy app, watching every change all the time would be work for nothing.
   */
  private watchPage(on: boolean) {
    if (!on) {
      this.mutationObserver?.disconnect();
      this.mutationObserver = null;
      return;
    }
    if (this.mutationObserver || typeof MutationObserver === 'undefined') return;
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
