import type { ShowPayload, ShowStep, SkavelEvent } from '../types';
import { resolveLocator, isFreshEnough } from '../core/locator';
import type { SessionStore } from '../core/session';

export interface StepView {
  instruction: string;
  stepIndex: number;
  total: number;
  /** Null when no locator matched well enough; the step is still shown, just not highlighted. */
  el: Element | null;
}

/**
 * Manages an active Show walkthrough. State lives in SessionStore so a walkthrough
 * that triggers a full page load picks up on the next page.
 */
export class ShowMode {
  readonly payload: ShowPayload;
  private stepIndex: number;
  private session: SessionStore;
  private emit: (e: SkavelEvent) => void;

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

    this.emit({
      type: 'step',
      stepIndex: this.stepIndex,
      stepInstruction: step.instruction,
      elementFound: found,
    });

    return {
      instruction: step.instruction,
      stepIndex: this.stepIndex,
      total: this.payload.steps.length,
      el: found ? el : null,
    };
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
    this.persist();
    return true;
  }

  back(): void {
    if (this.stepIndex === 0) return;
    this.stepIndex--;
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
