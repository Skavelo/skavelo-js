// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { Widget, calloutPlacement, missingName, missingQuestion } from './widget';

const make = () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const noop = () => {};
  const events = {
    onAsk: noop, onStop: noop, onOpen: noop, onClose: vi.fn(), onStepNext: vi.fn(), onStepBack: noop, onFeedback: noop,
  };
  const widget = new Widget(root, undefined, events);
  const $ = (sel: string) => root.querySelector(sel) as HTMLElement;
  return { widget, $, events };
};

describe('walkthrough step', () => {
  it('shows the step title and details when it has them', () => {
    const { widget, $ } = make();
    widget.showStep({
      title: 'Send an invoice', instruction: 'Click **New invoice**.', heading: 'Create the invoice',
      details: 'Have the customer’s email ready.', stepIndex: 0, total: 3, found: true,
    });
    expect($('.sk-step-heading').hidden).toBe(false);
    expect($('.sk-step-heading').textContent).toBe('Create the invoice');
    expect($('.sk-step-details').hidden).toBe(false);
    expect($('.sk-step-text').innerHTML).toContain('<strong>New invoice</strong>');
  });

  it('looks as before without them', () => {
    const { widget, $ } = make();
    widget.showStep({ title: 'x', instruction: 'Click **Save**.', stepIndex: 1, total: 3, found: true });
    expect($('.sk-step-heading').hidden).toBe(true);
    expect($('.sk-step-details').hidden).toBe(true);
  });
});

describe('walkthrough introduction', () => {
  it('shows the name, description and steps, and Start begins it', () => {
    const { widget, $ } = make();
    const done = vi.fn();
    widget.showIntro({ name: 'Send your first invoice', description: 'Create and send an invoice.', total: 4 }, done);
    expect($('.sk-intro').hidden).toBe(false);
    expect($('.sk-intro-name').textContent).toBe('Send your first invoice');
    expect($('.sk-intro-count').textContent).toBe('4 steps');
    $('.sk-intro-start').click();
    expect(done).toHaveBeenCalledWith(true);
    expect($('.sk-intro').hidden).toBe(true);
  });

  it('Not now closes it without starting', () => {
    const { widget, $ } = make();
    const done = vi.fn();
    widget.showIntro({ name: 'Send your first invoice', total: 1 }, done);
    expect($('.sk-intro-text').hidden).toBe(true);
    expect($('.sk-intro-count').textContent).toBe('1 step');
    $('.sk-intro-later').click();
    expect(done).toHaveBeenCalledWith(false);
    expect($('.sk-panel').hidden).toBe(true);
  });

  it('closing the panel counts as Not now', () => {
    const { widget } = make();
    const done = vi.fn();
    widget.showIntro({ name: 'x', total: 2 }, done);
    widget.close();
    expect(done).toHaveBeenCalledWith(false);
  });
});

describe('walkthrough callout', () => {
  const button = () => {
    const el = document.createElement('button');
    el.textContent = 'Domains';
    document.body.append(el);
    return el;
  };
  const step = (anchor: Element | null, stepIndex = 0) => ({
    title: 'Add a sending domain', instruction: 'Click **Domains**.', heading: 'Open your domains',
    details: 'Every domain you send from is listed here.', stepIndex, total: 5, found: !!anchor, anchor,
  });

  it('shows the step beside its control, with the panel down to the launcher', () => {
    const { widget, $ } = make();
    widget.showStep(step(button()));
    expect($('.sk-callout').hidden).toBe(false);
    expect($('.sk-panel').hidden).toBe(true);
    expect($('.sk-pill').hidden).toBe(false);
    expect($('.sk-co-heading').textContent).toBe('Open your domains');
    expect($('.sk-co-text').innerHTML).toContain('<strong>Domains</strong>');
    expect($('.sk-callout .sk-count').textContent).toBe('1 of 5');
  });

  it('Next in the callout moves the walkthrough on', () => {
    const { widget, $, events } = make();
    widget.showStep(step(button()));
    ($('.sk-co-next') as HTMLButtonElement).click();
    expect(events.onStepNext).toHaveBeenCalled();
  });

  it('Ask opens the panel on the same step, and closing it goes back to the callout', () => {
    const { widget, $, events } = make();
    const el = button();
    widget.showStep(step(el));
    $('.sk-co-ask').click();
    expect($('.sk-panel').hidden).toBe(false);
    expect($('.sk-callout').hidden).toBe(true);
    // The page redraws while the panel is open: the step stays in the panel.
    widget.showStep(step(el));
    expect($('.sk-panel').hidden).toBe(false);
    widget.close();
    expect($('.sk-callout').hidden).toBe(false);
    expect($('.sk-panel').hidden).toBe(true);
    expect(events.onClose).not.toHaveBeenCalled();
  });

  it('the next step goes back beside its control', () => {
    const { widget, $ } = make();
    widget.showStep(step(button()));
    $('.sk-co-ask').click();
    widget.showStep(step(button(), 1));
    expect($('.sk-callout').hidden).toBe(false);
    expect($('.sk-panel').hidden).toBe(true);
  });

  it('its cross ends the walkthrough', () => {
    const { widget, $, events } = make();
    widget.showStep(step(button()));
    $('.sk-co-close').click();
    expect(events.onClose).toHaveBeenCalled();
    expect($('.sk-callout').hidden).toBe(true);
  });

  it('stays in the panel when the control isn\'t on the page', () => {
    const { widget, $ } = make();
    widget.showStep(step(null));
    expect($('.sk-callout').hidden).toBe(true);
    expect($('.sk-panel').hidden).toBe(false);
  });

  it('waits a moment for a control that disappears while the page changes', () => {
    vi.useFakeTimers();
    try {
      const { widget, $ } = make();
      widget.showStep(step(button()));
      widget.showStep(step(null));
      expect($('.sk-panel').hidden).toBe(true);
      widget.showStep(step(button()));
      vi.advanceTimersByTime(2000);
      expect($('.sk-callout').hidden).toBe(false);
      expect($('.sk-panel').hidden).toBe(true);
      // Gone for good: the step moves to the panel.
      widget.showStep(step(null));
      vi.advanceTimersByTime(2000);
      expect($('.sk-panel').hidden).toBe(false);
      expect($('.sk-callout').hidden).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stays in the panel on a phone', () => {
    const width = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    try {
      const { widget, $ } = make();
      widget.showStep(step(button()));
      expect($('.sk-callout').hidden).toBe(true);
      expect($('.sk-panel').hidden).toBe(false);
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
    }
  });

  it('is cleared when the walkthrough ends', () => {
    const { widget, $ } = make();
    widget.showStep(step(button()));
    widget.clearStep();
    expect($('.sk-callout').hidden).toBe(true);
  });
});

describe('calloutPlacement', () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height });
  const size = { w: 340, h: 160 };
  const view = { vw: 1440, vh: 900 };

  it('goes below the control when there is room, with the notch facing it', () => {
    const p = calloutPlacement(rect(420, 50, 200, 40), size, view);
    expect(p.side).toBe('top');
    expect(p.top).toBe(106);
    expect(p.arrow).toBe(170);
  });

  it('goes above a control near the bottom', () => {
    const p = calloutPlacement(rect(420, 800, 200, 40), size, view);
    expect(p.side).toBe('bottom');
    expect(p.top).toBe(800 - 16 - 160);
  });

  it('goes beside a control too tall for above or below', () => {
    const p = calloutPlacement(rect(100, 20, 300, 860), size, view);
    expect(p.side).toBe('left');
    expect(p.left).toBe(416);
  });

  it('keeps clear of the launcher', () => {
    const launcher = rect(620, 820, 200, 52);
    const p = calloutPlacement(rect(560, 620, 320, 40), size, view, launcher);
    expect(p.side).toBe('bottom');
  });

  it('stays on screen at the right edge', () => {
    const p = calloutPlacement(rect(1380, 50, 50, 30), size, view);
    expect(p.left + size.w).toBeLessThanOrEqual(1440 - 12);
    expect(p.arrow).toBeLessThanOrEqual(size.w - 18);
  });
});

describe('a step with nothing to point at', () => {
  it('names what it can\'t find and offers a way forward', () => {
    const { widget, $ } = make();
    widget.showStep({ title: 'x', instruction: 'Enter your domain in the **Domain** field.', stepIndex: 2, total: 5, found: false });
    expect($('.sk-step-note').hidden).toBe(false);
    expect($('.sk-note-text').innerHTML).toBe("I can't find the <strong>Domain</strong> field on this screen.");
    expect($('.sk-note-back').textContent).toBe('Back to step 2');
    $('.sk-note-ask').click();
    expect(($('.sk-ask input') as HTMLInputElement).value).toBe('Where do I find the Domain field?');
  });

  it('has no Back on the first step', () => {
    const { widget, $ } = make();
    widget.showStep({ title: 'x', instruction: 'Click **Export**.', stepIndex: 0, total: 2, found: false });
    expect($('.sk-note-back').hidden).toBe(true);
  });

  it('reads names out of instructions', () => {
    expect(missingName('Click **Add Domain**.')).toBe('**Add Domain**');
    expect(missingName('Open the **Billing** tab.')).toBe('the **Billing** tab');
    expect(missingName('Scroll down a little.')).toBeNull();
    expect(missingQuestion('Scroll down a little.')).toBe("I can't find where to do this: Scroll down a little. Where is it?");
  });
});
