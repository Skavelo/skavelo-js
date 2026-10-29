// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Widget, launcherHeight, type AppliedTheme } from './widget';

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
  return { widget, $, events };
};

afterEach(() => sessionStorage.clear());

describe('launcher size', () => {
  it('maps presets and pixels, and keeps pixels in range', () => {
    expect(launcherHeight(undefined)).toBe(52);
    expect(launcherHeight('sm')).toBe(44);
    expect(launcherHeight('xl')).toBe(68);
    expect(launcherHeight(64)).toBe(64);
    expect(launcherHeight('64')).toBe(64);
    expect(launcherHeight(10)).toBe(32);
    expect(launcherHeight(500)).toBe(96);
    expect(launcherHeight('huge')).toBe(52);
  });

  it('sets the launcher height', () => {
    const { $ } = make({ size: 'lg' });
    expect($('.sk-pill').style.getPropertyValue('--sk-launch')).toBe('60px');
  });
});

describe('icon-only launcher', () => {
  it('is round and keeps its text as the accessible name', () => {
    const { $ } = make({ launcher: 'icon', label: 'Ask Acme' });
    expect($('.sk-pill').classList.contains('sk-pill--icon')).toBe(true);
    expect($('.sk-label').textContent).toBe('Ask Acme');
  });

  it('goes back to the label when switched', () => {
    const { widget, $ } = make({ launcher: 'icon' });
    widget.applyTheme({ launcher: 'label' });
    expect($('.sk-pill').classList.contains('sk-pill--icon')).toBe(false);
  });
});

describe('start with the input', () => {
  it('opens the question bar once settings arrive, without an open event', () => {
    const { widget, $, events } = make({ start: 'input' });
    expect($('.sk-composer').hidden).toBe(true);
    widget.setReady(true);
    expect($('.sk-composer').hidden).toBe(false);
    expect($('.sk-pill').hidden).toBe(true);
    expect(events.onOpen).not.toHaveBeenCalled();
  });

  it('stays on the launcher for the rest of the visit once closed', () => {
    const first = make({ start: 'input' });
    first.widget.setReady(true);
    first.$('.sk-x').click();
    expect(first.$('.sk-pill').hidden).toBe(false);

    const next = make({ start: 'input' });
    next.widget.setReady(true);
    expect(next.$('.sk-composer').hidden).toBe(true);
  });

  it('only chooses the first view once', () => {
    const { widget, $ } = make({ start: 'input' });
    widget.setReady(true);
    widget.close();
    widget.setReady(true);
    expect($('.sk-composer').hidden).toBe(true);
  });

  it('starts on the launcher by default', () => {
    const { widget, $ } = make();
    widget.setReady(true);
    expect($('.sk-pill').hidden).toBe(false);
  });
});
