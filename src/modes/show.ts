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
    this.stepIndex = Math.min(Math.max(opts.startAt ?? 0, 0), payload.steps.length - 1);
    this.persist();
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
    const found = !!el && isFreshEnough(score);

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
