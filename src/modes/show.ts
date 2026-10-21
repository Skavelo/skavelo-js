import type { ShowPayload, ShowStep, SkavelEvent } from '../types';
import { resolveLocator, isFreshEnough } from '../core/locator';
import type { SessionStore } from '../core/session';

export interface StepView {
  instruction: string;
  /** The step's own heading and explanation, when it has them. A link to another page has none. */
  heading?: string;
  details?: string;
  stepIndex: number;
  total: number;
  /** Null when no locator matched well enough; the step is still shown, just not highlighted. */
  el: Element | null;
  /**
   * The step is on another page and el is a link there, like the Settings icon for a step in
   * Settings. Following it doesn't finish the step: the step shows again on the page it opens.
   */
  bridge?: boolean;
  /**
   * The step's control isn't on screen, but an earlier step's is, like **Add Domain** for a field
   * inside the window it opens. el is that earlier control; doing it leads back to this step.
   */
  lead?: boolean;
}

/**
 * How long a step's control may be missing before an earlier step's control is offered instead.
 * Right after a step is reached its control is often still on its way in (a window opening), and
 * pointing back at the button just clicked would be wrong.
 */
export const LEAD_AFTER_MS = 1000;

/**
 * Manages an active Show walkthrough. State lives in SessionStore so a walkthrough
 * that triggers a full page load picks up on the next page.
 */
export class ShowMode {
  readonly payload: ShowPayload;
  private stepIndex: number;
  private session: SessionStore;
  private emit: (e: SkavelEvent) => void;
  /** When the visitor reached the current step. */
  private stepSince = Date.now();

  readonly messageId: string | undefined;

  constructor(
    payload: ShowPayload,
    session: SessionStore,
    emit: (e: SkavelEvent) => void,
    opts: { startAt?: number; messageId?: string } = {},
  ) {
    this.payload = payload;
    this.messageId = opts.messageId;
    this.session = session;
    this.emit = emit;
    // A fresh walkthrough skips opening steps that only lead to the page the user is already on.
    const start = opts.startAt ?? alreadyHere(payload.steps);
    this.stepIndex = Math.min(Math.max(start, 0), payload.steps.length - 1);
    this.persist();
  }

  /** The step the visitor is on, counting from 0. */
  get stepIndexNow(): number {
    return this.stepIndex;
  }

  get title(): string {
    return this.payload.name ?? 'Walkthrough';
  }

  currentStep(): ShowStep | null {
    return this.payload.steps[this.stepIndex] ?? null;
  }

  resolve(): StepView | null {
    const step = this.currentStep();
    if (!step) return null;

    const { el, score } = resolveLocator(step.locators);
    // A step from another page must not light up a look-alike here, like a contact's "Open menu"
    // for an automation's. Links and the top bar or sidebar look the same on every page.
    const elsewhere = !!step.pageUrlPattern && !onPage(step.pageUrlPattern)
      && !el?.closest('a[href], nav, header, aside, [role="navigation"], [role="banner"]');
    const found = !!el && isFreshEnough(score) && !elsewhere;

    // The step belongs on another page: point at a link that goes there first.
    const way = !found && step.pageUrlPattern && !onPage(step.pageUrlPattern) ? wayTo(step.pageUrlPattern) : null;
    if (way) {
      this.emit({ type: 'step', stepIndex: this.stepIndex, stepInstruction: step.instruction, elementFound: true });
      return {
        instruction: `Open **${way.label}** first.`,
        stepIndex: this.stepIndex,
        total: this.payload.steps.length,
        el: way.el,
        bridge: true,
      };
    }

    // On the right page, but the control is behind something an earlier step opens.
    const lead = !found && this.msUntilLead() === 0 ? this.wayIn() : null;
    if (lead) {
      this.emit({ type: 'step', stepIndex: this.stepIndex, stepInstruction: step.instruction, elementFound: true });
      return {
        instruction: `First, ${lowerFirst(lead.instruction)}`,
        ...(step.title ? { heading: step.title } : {}),
        details: `Then ${lowerFirst(step.instruction)}`,
        stepIndex: this.stepIndex,
        total: this.payload.steps.length,
        el: lead.el,
        bridge: true,
        lead: true,
      };
    }

    this.emit({
      type: 'step',
      stepIndex: this.stepIndex,
      stepInstruction: step.instruction,
      elementFound: found,
    });

    return {
      instruction: step.instruction,
      ...(step.title ? { heading: step.title } : {}),
      ...(step.details ? { details: step.details } : {}),
      stepIndex: this.stepIndex,
      total: this.payload.steps.length,
      el: found ? el : null,
    };
  }

  /** Milliseconds before a missing control may be led to through an earlier step; 0 once it may. */
  msUntilLead(now = Date.now()): number {
    return Math.max(0, this.stepSince + LEAD_AFTER_MS - now);
  }

  /** The nearest earlier step whose control is on screen here, and its instruction. */
  private wayIn(): { el: Element; instruction: string } | null {
    for (let i = this.stepIndex - 1; i >= 0; i--) {
      const earlier = this.payload.steps[i];
      const { el, score } = resolveLocator(earlier.locators);
      if (!el || !isFreshEnough(score)) continue;
      // A look-alike from another page doesn't count, except links and the top bar or sidebar.
      const elsewhere = !!earlier.pageUrlPattern && !onPage(earlier.pageUrlPattern)
        && !el.closest('a[href], nav, header, aside, [role="navigation"], [role="banner"]');
      if (!elsewhere) return { el, instruction: earlier.instruction };
    }
    return null;
  }

  /** Returns false when the walkthrough just finished. */
  advance(): boolean {
    this.emit({ type: 'step_complete', stepIndex: this.stepIndex });
    if (this.stepIndex + 1 >= this.payload.steps.length) {
      this.session.setWalkthrough(undefined);
      this.emit({ type: 'walkthrough_complete', workflowId: this.payload.workflowId });
      return false;
    }
    this.stepIndex++;
    this.stepSince = Date.now();
    this.persist();
    return true;
  }

  back(): void {
    if (this.stepIndex === 0) return;
    this.stepIndex--;
    this.stepSince = Date.now();
    this.persist();
  }

  abandon() {
    this.emit({
      type: 'walkthrough_abandon',
      workflowId: this.payload.workflowId,
      atStep: this.stepIndex,
    });
    this.session.setWalkthrough(undefined);
  }

  private persist() {
    this.session.setWalkthrough({ payload: this.payload, stepIndex: this.stepIndex, messageId: this.messageId });
  }
}

/**
 * A visible link on this page to the page a step is on: one that goes there exactly, or else the
 * closest one above it, like /settings for a step on /settings/compliance. Null when there's none.
 */
export function wayTo(pattern: string): { el: HTMLAnchorElement; label: string } | null {
  const target = pattern.split('#')[0].replace(/\/+$/, '') || '/';
  let best: { el: HTMLAnchorElement; label: string; rank: number } | null = null;
  for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    let path: string;
    try {
      const u = new URL(a.href);
      if (u.origin !== location.origin) continue;
      path = u.pathname.replace(/\/+$/, '') || '/';
    } catch {
      continue;
    }
    const exact = onPage(target, path);
    const above = !exact && path !== '/' && target.startsWith(`${path}/`);
    if (!exact && !above) continue;
    const r = a.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || getComputedStyle(a).visibility === 'hidden') continue;
    const label = (a.getAttribute('aria-label') || a.textContent || a.title || '').replace(/\s+/g, ' ').trim();
    if (!label) continue;
    const rank = exact ? 10_000 : path.length;
    if (!best || rank > best.rank) best = { el: a, label, rank };
  }
  return best && { el: best.el, label: best.label };
}

/** "Click **Add Domain**." becomes "click **Add Domain**.", leaving names like "API" alone. */
function lowerFirst(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/** How many leading steps are links to the current page, e.g. "Click **Automations**" while on Automations. */
export function alreadyHere(steps: ShowStep[]): number {
  let i = 0;
  while (i < steps.length - 1) {
    const { el } = resolveLocator(steps[i].locators);
    const href = el instanceof HTMLAnchorElement ? el.href : null;
    if (!href || !samePage(href, location.href)) break;
    i += 1;
  }
  return i;
}

function samePage(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    const path = (u: URL) => u.pathname.replace(/\/+$/, '') || '/';
    return x.origin === y.origin && path(x) === path(y) && x.hash === y.hash;
  } catch {
    return false;
  }
}

/** Whether the current address fits a step's page pattern, where :id stands for any one segment. */
export function onPage(pattern: string, here: string = location.pathname + location.hash): boolean {
  const trim = (p: string) => p.replace(/\/+$/, '') || '/';
  const [path, hash = ''] = pattern.split('#');
  const [herePath, hereHash = ''] = here.split('#');
  const re = (p: string) => new RegExp('^' + trim(p).split(':id').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]+') + '$');
  return re(path).test(trim(herePath)) && (!hash || re(hash).test(trim(hereHash)));
}
