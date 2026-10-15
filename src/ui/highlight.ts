/**
 * Marks the element a walkthrough step points at, in one of four styles:
 * - beacon: a thin ring plus a dot on the corner that sends out ripples (default)
 * - spotlight: dims the rest of the page around a cutout
 * - trace: the ring draws itself around the element, then breathes
 * - ring: a plain ring that pulses twice
 *
 * The motion keeps going while the step is on screen and pauses while the visitor's pointer
 * or focus is on the element, so it never moves under their cursor. Only opacity and
 * transform are animated. With reduced motion every style is drawn still.
 * Clicks always pass through to the page.
 */

import type { HighlightStyle } from '../types';

export const HIGHLIGHT_STYLES: HighlightStyle[] = ['beacon', 'spotlight', 'trace', 'ring'];
const DEFAULT_STYLE: HighlightStyle = 'beacon';
const DEFAULT_ACCENT = '#A3224A';
const EASE = 'cubic-bezier(.2,.8,.2,1)';

const HIGHLIGHT_CSS = `
  .sk-hl-overlay {
    --sk-signal: ${DEFAULT_ACCENT};
    position: fixed;
    inset: 0;
    pointer-events: none;
    /* Under the widget, so a spotlight never dims the step instructions. */
    z-index: 2147483644;
    overflow: hidden;
  }
  .sk-hl-overlay.sk-hl-contained { position: absolute; z-index: 0; }
  .sk-hl-overlay[hidden], .sk-hl-overlay [hidden] { display: none; }

  .sk-hl-mark {
    position: absolute;
    box-sizing: border-box;
    pointer-events: none;
    transition: top 280ms ${EASE}, left 280ms ${EASE}, width 280ms ${EASE}, height 280ms ${EASE};
  }

  /* Ring and beacon: a crisp ring with a white gap, so it reads on any background. */
  .sk-hl-ring-line {
    position: absolute;
    inset: -4px;
    border-radius: inherit;
    /* White gap, the ring, then a soft glow so it reads on busy and pale pages alike. */
    box-shadow:
      0 0 0 2px #fff,
      0 0 0 4.5px var(--sk-signal),
      0 0 0 9px color-mix(in srgb, var(--sk-signal) 16%, transparent),
      0 8px 24px color-mix(in srgb, var(--sk-signal) 35%, transparent);
  }
  .sk-hl-halo {
    position: absolute;
    inset: -4px;
    border-radius: inherit;
    box-shadow: 0 0 0 10px color-mix(in srgb, var(--sk-signal) 30%, transparent);
    opacity: 0;
  }
  .sk-hl-style-ring .sk-hl-halo { animation: sk-hl-halo 1.1s ease-out 2; }
  @keyframes sk-hl-halo { 0% { opacity: 1; } 100% { opacity: 0; } }

  /* Beacon: a dot on the top right corner with two staggered ripples. */
  .sk-hl-dot {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 12px;
    height: 12px;
    transform: translate(50%, -50%);
  }
  .sk-hl-dot-core, .sk-hl-dot-wave {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: var(--sk-signal);
  }
  .sk-hl-dot-core { box-shadow: 0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,.25); }
  .sk-hl-dot-wave { opacity: 0; animation: sk-hl-wave 1.8s ${EASE} infinite; }
  .sk-hl-dot-wave + .sk-hl-dot-wave { animation-delay: .9s; }
  @keyframes sk-hl-wave { 0% { transform: scale(1); opacity: .55; } 100% { transform: scale(3.6); opacity: 0; } }

  /* Spotlight: one huge shadow dims everything outside the cutout. */
  .sk-hl-dim {
    position: absolute;
    inset: -6px;
    border-radius: inherit;
    box-shadow: 0 0 0 200vmax rgba(12, 10, 14, .58);
    animation: sk-hl-fade 320ms ease-out both;
  }
  .sk-hl-dim-edge {
    position: absolute;
    inset: -6px;
    border-radius: inherit;
    box-shadow: 0 0 0 2px var(--sk-signal), 0 0 18px 2px color-mix(in srgb, var(--sk-signal) 55%, transparent);
    animation: sk-hl-fade 320ms ease-out both, sk-hl-breathe 2.4s ease-in-out 320ms infinite;
  }
  @keyframes sk-hl-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sk-hl-breathe { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }

  /* Trace: an SVG outline drawn once around the element, then a soft glow that breathes. */
  .sk-hl-trace {
    position: absolute;
    overflow: visible;
  }
  .sk-hl-trace-line {
    fill: none;
    stroke: var(--sk-signal);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    animation: sk-hl-draw 700ms ${EASE} forwards;
  }
  .sk-hl-trace-glow {
    position: absolute;
    inset: -6px;
    border-radius: inherit;
    box-shadow: 0 0 16px 3px color-mix(in srgb, var(--sk-signal) 45%, transparent);
    opacity: 0;
    animation: sk-hl-glow-in 400ms ease-out 600ms forwards, sk-hl-breathe 2.4s ease-in-out 1s infinite;
  }
  @keyframes sk-hl-draw { to { stroke-dashoffset: 0; } }
  @keyframes sk-hl-glow-in { to { opacity: 1; } }

  /* Tight: items packed edge to edge, like a menu's. Anything drawn outside the item would cover
     its neighbours, so the marker sits inside it with a light tint. */
  .sk-hl-tight .sk-hl-ring-line, .sk-hl-tight .sk-hl-halo {
    inset: 1px;
    box-shadow: inset 0 0 0 2px var(--sk-signal), 0 4px 14px color-mix(in srgb, var(--sk-signal) 30%, transparent);
    background: color-mix(in srgb, var(--sk-signal) 12%, transparent);
  }
  .sk-hl-tight .sk-hl-halo { box-shadow: inset 0 0 0 6px color-mix(in srgb, var(--sk-signal) 25%, transparent); background: none; }
  .sk-hl-tight .sk-hl-dot { top: 50%; right: 10px; width: 8px; height: 8px; transform: translateY(-50%); }
  .sk-hl-tight .sk-hl-dot-wave { animation-name: sk-hl-wave-sm; }
  @keyframes sk-hl-wave-sm { 0% { transform: scale(1); opacity: .5; } 100% { transform: scale(2.4); opacity: 0; } }
  .sk-hl-tight .sk-hl-dim, .sk-hl-tight .sk-hl-dim-edge, .sk-hl-tight .sk-hl-trace-glow { inset: 0; }

  /* Settled: the pointer or focus is on the element. Keep the marker, pause the motion. */
  .sk-hl-settled .sk-hl-dot-wave { animation: none; opacity: 0; }
  .sk-hl-settled .sk-hl-dim-edge, .sk-hl-settled .sk-hl-trace-glow { animation: none; opacity: 1; }
  .sk-hl-settled .sk-hl-trace-line { animation: none; stroke-dashoffset: 0; }

  @media (prefers-reduced-motion: reduce) {
    .sk-hl-mark { transition: none; }
    .sk-hl-halo, .sk-hl-dot-wave { animation: none; }
    .sk-hl-dot-wave:first-child { opacity: .25; transform: scale(2.2); }
    .sk-hl-dim, .sk-hl-dim-edge, .sk-hl-trace-glow { animation: none; opacity: 1; }
    .sk-hl-trace-line { animation: none; stroke-dashoffset: 0; }
  }
`;

const SVG_NS = 'http://www.w3.org/2000/svg';

export class HighlightOverlay {
  private container: HTMLElement;
  private mark: HTMLElement;
  private style: HighlightStyle = DEFAULT_STYLE;
  private target: Element | null = null;
  private frame = 0;
  private watchFrame = 0;
  private lastRect = '';
  private resizeObserver: ResizeObserver | null = null;
  private svg: SVGSVGElement | null = null;
  private svgRect: SVGRectElement | null = null;

  /**
   * contained: draw inside the overlay's parent (the dashboard preview) instead of the
   * viewport. Coordinates are then relative to that parent, and the page is never scrolled.
   */
  constructor(root: ShadowRoot, accent?: string, private opts: { contained?: boolean; parent?: HTMLElement } = {}) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(HIGHLIGHT_CSS);
    root.adoptedStyleSheets = [...(root.adoptedStyleSheets ?? []), sheet];

    this.container = document.createElement('div');
    this.container.className = opts.contained ? 'sk-hl-overlay sk-hl-contained' : 'sk-hl-overlay';
    this.container.hidden = true;
    this.mark = document.createElement('div');
    this.container.appendChild(this.mark);
    (opts.parent ?? root).appendChild(this.container);
    this.setTheme({ accent });
  }

  /** Accent and style come from the dashboard and code settings; unknown styles fall back to beacon. */
  setTheme(theme: { accent?: string; highlight?: string }) {
    this.container.style.setProperty('--sk-signal', theme.accent || DEFAULT_ACCENT);
    if (theme.highlight !== undefined) {
      const next = (HIGHLIGHT_STYLES as string[]).includes(theme.highlight) ? (theme.highlight as HighlightStyle) : DEFAULT_STYLE;
      if (next !== this.style) {
        this.style = next;
        if (this.target) this.build();
      }
    }
  }

  point(el: Element) {
    const isNewTarget = el !== this.target;
    if (isNewTarget) this.release();
    this.target = el;
    this.container.hidden = false;

    if (isNewTarget) {
      if (!this.opts.contained) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      el.addEventListener('pointerenter', this.settle);
      el.addEventListener('focusin', this.settle);
      el.addEventListener('pointerleave', this.unsettle);
      el.addEventListener('focusout', this.unsettle);
      if (this.opts.contained) {
        this.resizeObserver = new ResizeObserver(this.onViewportChange);
        this.resizeObserver.observe(this.container.parentElement ?? document.body);
      } else {
        window.addEventListener('scroll', this.onViewportChange, true);
        window.addEventListener('resize', this.onViewportChange);
      }
      // Rebuilt for each new element so the entrance animation plays again.
      this.mark.style.transition = '';
      this.build();
      this.watch();
    } else {
      this.reposition();
    }
  }

  /** Plays the entrance again on the same element (the preview uses this when the style changes). */
  replay() {
    if (this.target) this.build();
  }

  hide() {
    this.release();
    this.target = null;
    this.container.hidden = true;
    this.mark.replaceChildren();
  }

  destroy() {
    this.hide();
    this.container.remove();
  }

  private release() {
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.watchFrame);
    this.lastRect = '';
    this.target?.removeEventListener('pointerenter', this.settle);
    this.target?.removeEventListener('focusin', this.settle);
    this.target?.removeEventListener('pointerleave', this.unsettle);
    this.target?.removeEventListener('focusout', this.unsettle);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('scroll', this.onViewportChange, true);
    window.removeEventListener('resize', this.onViewportChange);
  }

  private settle = () => {
    this.mark.classList.add('sk-hl-settled');
  };

  // Resumes once neither the pointer nor focus is on the element.
  private unsettle = () => {
    const el = this.target;
    if (!el) return;
    requestAnimationFrame(() => {
      if (el === this.target && !el.matches(':hover') && !el.contains(document.activeElement)) {
        this.mark.classList.remove('sk-hl-settled');
      }
    });
  };

  private build() {
    this.mark.className = `sk-hl-mark sk-hl-style-${this.style}`;
    this.mark.replaceChildren();
    this.svg = this.svgRect = null;
    const part = (cls: string) => {
      const d = document.createElement('div');
      d.className = cls;
      return d;
    };

    switch (this.style) {
      case 'ring':
        this.mark.append(part('sk-hl-halo'), part('sk-hl-ring-line'));
        break;
      case 'beacon': {
        const dot = part('sk-hl-dot');
        dot.append(part('sk-hl-dot-wave'), part('sk-hl-dot-wave'), part('sk-hl-dot-core'));
        this.mark.append(part('sk-hl-ring-line'), dot);
        break;
      }
      case 'spotlight':
        this.mark.append(part('sk-hl-dim'), part('sk-hl-dim-edge'));
        break;
      case 'trace': {
        this.svg = document.createElementNS(SVG_NS, 'svg');
        this.svg.setAttribute('class', 'sk-hl-trace');
        this.svgRect = document.createElementNS(SVG_NS, 'rect');
        this.svgRect.setAttribute('class', 'sk-hl-trace-line');
        this.svgRect.setAttribute('pathLength', '100');
        this.svg.appendChild(this.svgRect);
        this.mark.append(part('sk-hl-trace-glow'), this.svg);
        break;
      }
    }
    this.reposition();
    if (this.target?.matches(':hover')) this.settle();
  }

  /**
   * Follows the element while it moves on its own, like a menu item that scales and slides in
   * as the menu opens, or a row that shifts when the list above it loads. Scroll and resize
   * alone would leave the ring where the element was when the step started.
   */
  private watch = () => {
    const el = this.target;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const key = `${Math.round(r.top)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}`;
    if (this.lastRect && key !== this.lastRect) {
      // Glides only between steps; following an element that moves by itself is instant.
      this.mark.style.transition = 'none';
      this.reposition();
    }
    this.lastRect = key;
    this.watchFrame = requestAnimationFrame(this.watch);
  };

  private onViewportChange = () => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.reposition());
  };

  private reposition() {
    if (!this.target) return;
    const el = this.target.getBoundingClientRect();
    // A closed menu leaves its item in the page with no size; nothing to point at until it opens.
    this.mark.style.visibility = el.width || el.height ? '' : 'hidden';
    // Fixed overlays use viewport coordinates as is; a contained one is offset by its parent.
    const box = this.opts.contained
      ? this.container.getBoundingClientRect()
      : { top: 0, left: 0, right: document.documentElement.clientWidth, bottom: document.documentElement.clientHeight };
    const radius = parseFloat(window.getComputedStyle(this.target).borderTopLeftRadius) || 4;
    const tight = isPacked(this.target);
    this.mark.classList.toggle('sk-hl-tight', tight);
    // The marker is drawn outside the element (the ring by 4 to 6px, the beacon's dot past its
    // corner). For an element flush with an edge, like a top nav, that part would be cut off, so
    // the marker is pulled inside the visible area by that much.
    const edge = this.style === 'beacon' ? 12 : 7;
    const top = Math.max(el.top, box.top + edge);
    const left = Math.max(el.left, box.left + edge);
    const bottom = Math.min(el.bottom, box.bottom - edge);
    const right = Math.min(el.right, box.right - edge);
    // Only when enough of the element is left to point at; otherwise draw it where it is.
    const fits = bottom - top >= 8 && right - left >= 8;
    const rect = fits ? { top, left, width: right - left, height: bottom - top } : el;
    Object.assign(this.mark.style, {
      top: `${rect.top - box.top}px`,
      left: `${rect.left - box.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      borderRadius: `${radius}px`,
    });

    if (this.svg && this.svgRect) {
      // The outline sits 5px outside the element, like the ring styles; inside it when packed.
      const pad = tight ? -1.5 : 5;
      const w = rect.width + pad * 2;
      const h = rect.height + pad * 2;
      Object.assign(this.svg.style, { left: `${-pad}px`, top: `${-pad}px`, width: `${w}px`, height: `${h}px` });
      this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const r = Math.min(radius + pad, h / 2);
      for (const [k, v] of Object.entries({ x: 1.25, y: 1.25, width: w - 2.5, height: h - 2.5, rx: r, ry: r })) {
        this.svgRect.setAttribute(k, String(v));
      }
    }
  }
}

/** Menu items, list options and tabs sit edge to edge, with no room around them for a ring. */
function isPacked(el: Element): boolean {
  return el.matches('[role^="menuitem"], [role="option"], [role="treeitem"]')
    || !!el.closest('[role="menu"], [role="menubar"], [role="listbox"], [role="tree"]');
}
