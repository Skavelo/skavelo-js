// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GhostCursor } from './ghost-cursor';

const media = (matches: Record<string, boolean>) => {
  window.matchMedia = ((q: string) => ({ matches: !!matches[q], media: q })) as unknown as typeof window.matchMedia;
};
const REDUCED = '(prefers-reduced-motion: reduce)';
const TOUCH = '(hover: none) and (pointer: coarse)';

const make = () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const cursor = new GhostCursor(root, { origin: () => ({ x: 600, y: 760 }) });
  const layer = root.querySelector('.sk-gc-layer') as HTMLElement;
  return { cursor, layer, root };
};

const button = (box = { left: 100, top: 200, width: 120, height: 40 }) => {
  const b = document.createElement('button');
  b.textContent = 'New invoice';
  document.body.append(b);
  b.getBoundingClientRect = () => ({
    ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => ({}),
  }) as DOMRect;
  b.scrollIntoView = vi.fn();
  return b;
};

beforeEach(() => {
  document.body.innerHTML = '';
  media({ [REDUCED]: true });
});
afterEach(() => vi.restoreAllMocks());

describe('GhostCursor', () => {
  it("lands in the control's bottom right corner, so it doesn't cover the label", async () => {
    const { cursor, layer } = make();
    const el = button();
    expect(await cursor.moveTo(el)).toBe(true);
    expect(layer.hidden).toBe(false);
    // Just inside the bottom right corner.
    expect(cursor.position()).toEqual({ x: 100 + 120 - 12, y: 200 + 40 - 7 });
  });

  it('is never in the way: no clicks and no screen reader', () => {
    const { layer } = make();
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.className).toContain('sk-gc-layer');
  });

  it('shows the assistant name beside the arrow', () => {
    const { cursor, root } = make();
    cursor.setTheme({ label: 'Acme Assistant' });
    expect(root.querySelector('.sk-gc-label')?.textContent).toBe('Acme Assistant');
  });

  it('is off on touch screens: nothing drawn, and the walkthrough goes on without waiting', async () => {
    media({ [TOUCH]: true });
    const { cursor, layer } = make();
    expect(cursor.isOn()).toBe(false);
    expect(await cursor.moveTo(button())).toBe(true);
    expect(layer.hidden).toBe(true);
  });

  it('is off when the team switches it off', async () => {
    const { cursor, layer } = make();
    cursor.setTheme({ enabled: false });
    expect(await cursor.moveTo(button())).toBe(true);
    expect(layer.hidden).toBe(true);
  });

  it('gives way to a newer move, and hides when the walkthrough ends', async () => {
    const { cursor, layer } = make();
    const first = cursor.moveTo(button());
    cursor.hide();
    expect(await first).toBe(false);
    expect(layer.hidden).toBe(true);
    expect(cursor.position()).toBeNull();
  });

  it('steps aside after showing the way', async () => {
    const { cursor, root } = make();
    await cursor.moveTo(button());
    cursor.rest();
    expect(root.querySelector('.sk-gc')?.classList.contains('sk-gc-resting')).toBe(true);
    // The next step brings it back.
    await cursor.moveTo(button({ left: 300, top: 100, width: 80, height: 32 }));
    expect(root.querySelector('.sk-gc')?.classList.contains('sk-gc-resting')).toBe(false);
  });

  it('glides from the launcher when motion is allowed, and ends on the control', async () => {
    media({});
    const { cursor } = make();
    const el = button();
    expect(await cursor.moveTo(el)).toBe(true);
    expect(cursor.position()).toEqual({ x: 100 + 120 - 12, y: 200 + 40 - 7 });
  });
});
