// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { Widget } from './widget';

const make = () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const noop = () => {};
  const widget = new Widget(root, undefined, {
    onAsk: noop, onStop: noop, onOpen: noop, onClose: noop, onStepNext: noop, onStepBack: noop, onFeedback: noop,
  });
  const $ = (sel: string) => root.querySelector(sel) as HTMLElement;
  return { widget, $ };
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
