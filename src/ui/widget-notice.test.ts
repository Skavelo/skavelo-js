// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_DISCLAIMER, Widget, type AppliedTheme } from './widget';

const make = (theme?: AppliedTheme) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const noop = () => {};
  const events = {
    onAsk: noop, onStop: noop, onOpen: vi.fn(), onClose: noop, onStepNext: noop, onStepBack: noop, onFeedback: noop,
  };
  const widget = new Widget(root, theme, events);
  const $ = (sel: string) => root.querySelector(sel) as HTMLElement;
  return { widget, $ };
};

describe('disclaimer line', () => {
  it('shows by default, in the default words, without a link', () => {
    const { widget, $ } = make();
    widget.applyTheme({});
    expect($('.sk-notice').hidden).toBe(false);
    expect($('.sk-notice-text').textContent).toBe(DEFAULT_DISCLAIMER);
    expect($('.sk-notice-link').hidden).toBe(true);
  });

  it('uses the team’s words and https link, and opens it in a new tab', () => {
    const { widget, $ } = make();
    widget.applyTheme({ disclaimerText: 'Answers come from AI.', disclaimerUrl: 'https://example.com/ai' });
    expect($('.sk-notice-text').textContent).toBe('Answers come from AI.');
    const link = $('.sk-notice-link') as HTMLAnchorElement;
    expect(link.hidden).toBe(false);
    expect(link.getAttribute('href')).toBe('https://example.com/ai');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('never links anything but https, and shows words as text, not markup', () => {
    const { widget, $ } = make();
    widget.applyTheme({ disclaimerText: '<b>bold</b>', disclaimerUrl: 'javascript:alert(1)' });
    expect($('.sk-notice-text').innerHTML).toBe('&lt;b&gt;bold&lt;/b&gt;');
    expect($('.sk-notice-link').hidden).toBe(true);
    expect($('.sk-notice-link').hasAttribute('href')).toBe(false);
  });

  it('hides when switched off, and comes back when switched on', () => {
    const { widget, $ } = make();
    widget.applyTheme({ disclaimer: false });
    expect($('.sk-notice').hidden).toBe(true);
    widget.applyTheme({});
    expect($('.sk-notice').hidden).toBe(false);
  });
});
