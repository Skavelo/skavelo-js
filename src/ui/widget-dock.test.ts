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
  const docked = () => ['left', 'right'].find((s) => $('.sk-dock').classList.contains(`sk-docked-${s}`)) ?? null;
  const choose = (side: string) => {
    $('.sk-dock-btn').click();
    ($(`.sk-dock-menu [data-side="${side}"]`) as HTMLButtonElement).click();
  };
  return { widget, $, docked, choose };
};

const box = (el: Element, r: { left: number; right: number; top?: number; bottom?: number }) => {
  el.getBoundingClientRect = () => ({ top: 0, bottom: 800, width: r.right - r.left, height: 800, x: r.left, y: 0, ...r }) as DOMRect;
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
    const { widget, docked, choose, $ } = make({ panel: 'right' });
    widget.showView('panel');
    $('.sk-dock-btn').click();
    // The current side isn't offered again.
    expect(($('.sk-dock-menu [data-side="right"]') as HTMLButtonElement).hidden).toBe(true);
    ($('.sk-dock-menu [data-side="left"]') as HTMLButtonElement).click();
    expect(docked()).toBe('left');
    expect(localStorage.getItem('_sk_panel')).toBe('left');
    choose('float');
    expect(docked()).toBeNull();
    expect(localStorage.getItem('_sk_panel')).toBe('float');

    const next = make({ panel: 'right' });
    next.widget.showView('panel');
    expect(next.docked()).toBeNull();
  });

  it('docking ends Expand', () => {
    const { widget, choose, $ } = make();
    widget.showView('panel');
    $('.sk-expand').click();
    expect($('.sk-panel').classList.contains('sk-expanded')).toBe(true);
    choose('right');
    expect($('.sk-panel').classList.contains('sk-expanded')).toBe(false);
  });

  it('floats on a screen too small to dock', () => {
    wide = false;
    const { widget, docked } = make({ panel: 'right' });
    widget.showView('panel');
    expect(docked()).toBeNull();
  });

  it('shows a walkthrough step in the docked panel, not beside the control', () => {
    const { widget, $ } = make({ panel: 'right' });
    const target = document.createElement('button');
    document.body.append(target);
    widget.showView('panel');
    widget.showStep({ title: 'x', instruction: 'Click **Save**.', stepIndex: 0, total: 2, found: true, anchor: target });
    expect($('.sk-panel').hidden).toBe(false);
    expect($('.sk-step').hidden).toBe(false);
    expect($('.sk-callout').hidden).toBe(true);
  });

  it('moves to the other side for the walkthrough when it covers the control, then goes back', async () => {
    vi.useFakeTimers();
    const { widget, docked, $ } = make({ panel: 'right' });
    const target = document.createElement('button');
    document.body.append(target);
    box(target, { left: 900, right: 980, top: 100, bottom: 130 });
    box($('.sk-panel'), { left: 800, right: 1200 });
    widget.showView('panel');
    widget.showStep({ title: 'x', instruction: 'Click **Save**.', stepIndex: 0, total: 2, found: true, anchor: target });
    vi.advanceTimersByTime(500);
    expect(docked()).toBe('left');
    expect(localStorage.getItem('_sk_panel')).toBeNull();
    widget.clearStep();
    expect(docked()).toBe('right');
    vi.useRealTimers();
  });
});
