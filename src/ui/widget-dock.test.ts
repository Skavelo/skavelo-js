// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Widget, type AppliedTheme } from './widget';

let wide = true;
beforeEach(() => {
  wide = true;
  localStorage.clear();
  vi.stubGlobal('matchMedia', (q: string) => ({
    get matches() { return q.includes('min-width: 900px') ? wide : false; },
    addEventListener: () => {}, removeEventListener: () => {},
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

const make = (theme: AppliedTheme = {}) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const noop = () => {};
  const events = {
    onAsk: noop, onStop: noop, onOpen: noop, onClose: vi.fn(), onStepNext: noop, onStepBack: noop, onFeedback: noop,
  };
  const widget = new Widget(root, theme, events);
  widget.applyTheme(theme);
  const $ = (sel: string) => root.querySelector(sel) as HTMLElement;
  const $$ = (sel: string) => Array.from(root.querySelectorAll(sel)) as HTMLElement[];
  const docked = () => ['left', 'right'].find((s) => $('.sk-dock').classList.contains(`sk-docked-${s}`)) ?? null;
  /** What the ⋯ menu offers right now. */
  const offered = () => {
    $('.sk-more-btn').click();
    const items = $$('.sk-more-menu [role="menuitem"]').filter((b) => !b.hidden).map((b) => b.textContent);
    $('.sk-more-btn').click();
    return items;
  };
  const choose = (side: string) => {
    $('.sk-more-btn').click();
    ($(`.sk-more-menu [data-side="${side}"]`) as HTMLButtonElement).click();
  };
  return { widget, $, docked, choose, offered };
};

describe('docked panel', () => {
  it('floats by default, and docks to the side the team set', () => {
    const a = make();
    a.widget.showView('panel');
    expect(a.docked()).toBeNull();
    const b = make({ panel: 'right' });
    b.widget.showView('panel');
    expect(b.docked()).toBe('right');
  });

  it('only docks while the panel is open', () => {
    const { widget, docked } = make({ panel: 'left' });
    expect(docked()).toBeNull();
    widget.showView('panel');
    expect(docked()).toBe('left');
    widget.close();
    expect(docked()).toBeNull();
  });

  it('takes the visitor’s choice from the menu over the team’s, remembers it, and floats again', () => {
    const { widget, docked, choose, offered } = make({ panel: 'right' });
    widget.showView('panel');
    // Docked right: the other side and Float, but not Expand, which a docked panel doesn't need.
    expect(offered()).toEqual(['Dock to the left', 'Float']);
    choose('left');
    expect(docked()).toBe('left');
    expect(localStorage.getItem('_sk_panel')).toBe('left');
    choose('float');
    expect(docked()).toBeNull();
    expect(localStorage.getItem('_sk_panel')).toBe('float');

    const next = make({ panel: 'right' });
    next.widget.showView('panel');
    expect(next.docked()).toBeNull();
  });

  it('expands from the menu, offers to exit full size, and docking ends it', () => {
    const { widget, choose, offered, $ } = make();
    widget.showView('panel');
    expect(offered()).toEqual(['Expand', 'Dock to the left', 'Dock to the right']);
    $('.sk-more-btn').click();
    ($('.sk-more-menu [data-action="expand"]') as HTMLButtonElement).click();
    expect($('.sk-panel').classList.contains('sk-expanded')).toBe(true);
    expect(offered()[0]).toBe('Exit full size');
    choose('right');
    expect($('.sk-panel').classList.contains('sk-expanded')).toBe(false);
  });

  it('floats on a screen too small to dock, where the button is Expand itself, not a menu of one', () => {
    wide = false;
    const { widget, docked, $ } = make({ panel: 'right' });
    widget.showView('panel');
    expect(docked()).toBeNull();
    const btn = $('.sk-more-btn');
    expect(btn.getAttribute('aria-label')).toBe('Expand');
    expect(btn.hasAttribute('aria-haspopup')).toBe(false);
    btn.click();
    expect($('.sk-more-menu').hidden).toBe(true);
    expect($('.sk-panel').classList.contains('sk-expanded')).toBe(true);
    expect(btn.getAttribute('aria-label')).toBe('Exit full size');
    btn.click();
    expect($('.sk-panel').classList.contains('sk-expanded')).toBe(false);
  });

  it('runs a walkthrough the usual way, beside the control, and docks again when it’s over', () => {
    const { widget, docked, $ } = make({ panel: 'right' });
    const target = document.createElement('button');
    document.body.append(target);
    widget.showView('panel');
    expect(docked()).toBe('right');
    widget.showStep({ title: 'x', instruction: 'Click **Save**.', stepIndex: 0, total: 2, found: true, anchor: target });
    expect($('.sk-callout').hidden).toBe(false);
    expect($('.sk-panel').hidden).toBe(true);
    expect(docked()).toBeNull();
    // Finished: the ending shows in the panel on the visitor's side.
    widget.clearStep();
    widget.showEnding();
    expect(docked()).toBe('right');
  });

  it('floats an open docked panel when a step shows in it, like a control that isn’t on the page', () => {
    const { widget, docked, $ } = make({ panel: 'left' });
    widget.showView('panel');
    widget.showStep({ title: 'x', instruction: 'Click **Billing**.', stepIndex: 0, total: 2, found: false });
    expect($('.sk-panel').hidden).toBe(false);
    expect(docked()).toBeNull();
    widget.clearStep();
    expect(docked()).toBe('left');
  });

  it('floats for a walkthrough’s introduction, and docks again after Not now', () => {
    const { widget, docked, $ } = make({ panel: 'right' });
    widget.showView('panel');
    widget.showIntro({ name: 'Create an API key', total: 5 }, () => {});
    expect(docked()).toBeNull();
    ($('.sk-intro-later') as HTMLButtonElement).click();
    expect(docked()).toBe('right');
  });

  it('doesn’t offer docking during a walkthrough, which always runs the usual way', () => {
    const { widget, $ } = make({ panel: 'right' });
    widget.showView('panel');
    widget.showStep({ title: 'x', instruction: 'Click **Billing**.', stepIndex: 0, total: 2, found: false });
    expect($('.sk-more-btn').getAttribute('aria-label')).toBe('Expand');
  });
});
