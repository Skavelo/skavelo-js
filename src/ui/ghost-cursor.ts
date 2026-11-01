/**
 * The guide cursor: an arrow in the accent colour, labelled with the assistant's name, that glides
 * to each walkthrough step's control the way a teammate's cursor moves in a shared document. In a
 * guided walkthrough it shows where to go, then steps aside for the visitor to click. In Do it for
 * me it presses the controls and stays in each field while it types.
 *
 * It's drawn for people with a mouse only: on a touch screen there's no cursor to mirror, and the
 * highlight alone marks the control. With reduced motion it appears at the control without
 * gliding. It never takes clicks and screen readers skip it.
 */

const EASE = 'cubic-bezier(.2,.8,.2,1)';
const DEFAULT_ACCENT = '#A3224A';

const CURSOR_CSS = `
  .sk-gc-layer {
    --sk-gc-accent: ${DEFAULT_ACCENT};
    position: fixed;
    inset: 0;
    pointer-events: none;
    /* With the highlight, under the widget: it never covers the step's instructions. */
    z-index: 2147483644;
    overflow: hidden;
  }
  .sk-gc-layer.sk-gc-contained { position: absolute; z-index: 1; }
  .sk-gc-layer[hidden] { display: none; }
  .sk-gc {
    position: absolute;
    top: 0;
    left: 0;
    will-change: transform;
    transition: opacity 260ms ease-out;
  }
  .sk-gc-arrow { display: block; filter: drop-shadow(0 2px 4px rgba(0,0,0,.28)); }
  .sk-gc-arrow path { fill: var(--sk-gc-accent); stroke: #fff; stroke-width: 1.6; stroke-linejoin: round; }
  .sk-gc-label {
    position: absolute;
    top: 20px;
    left: 14px;
    max-width: 180px;
    padding: 3px 8px;
    border-radius: 7px;
    background: var(--sk-gc-accent);
    color: #fff;
    font: 600 11.5px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 0 0 1.5px #fff, 0 2px 6px rgba(0,0,0,.2);
  }
  .sk-gc-label:empty { display: none; }
  .sk-gc-ripple {
    position: absolute;
    top: -9px;
    left: -9px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--sk-gc-accent);
    opacity: 0;
  }
  .sk-gc-press .sk-gc-ripple { animation: sk-gc-ripple 420ms ${EASE}; }
  .sk-gc-press .sk-gc-arrow { animation: sk-gc-tap 220ms ease-out; }
  @keyframes sk-gc-ripple { 0% { opacity: .45; transform: scale(.4); } 100% { opacity: 0; transform: scale(2.4); } }
  @keyframes sk-gc-tap { 50% { transform: scale(.86); } }
  /* Guided: once it has shown the way, it steps aside for the visitor's own click. */
  .sk-gc-resting { opacity: 0; transition-delay: 700ms; }
  @media (prefers-reduced-motion: reduce) {
    .sk-gc { transition: none; }
    .sk-gc-press .sk-gc-ripple, .sk-gc-press .sk-gc-arrow { animation: none; }
  }
`;

const SVG_NS = 'http://www.w3.org/2000/svg';
// A classic pointer, its tip at (2, 2).
const ARROW = 'M2 2 L2 19.5 L6.6 15.4 L9.6 22 L12.8 20.6 L9.9 14.2 L16 14.2 Z';

type Point = { x: number; y: number };

export interface GhostCursorOptions {
  /** Draw inside `parent` (the dashboard preview) instead of over the page; the page is never scrolled. */
  contained?: boolean;
  parent?: HTMLElement;
  /** Where the first glide starts, in viewport coordinates: the launcher, so it comes from the widget. */
  origin?: () => Point | null;
}

export class GhostCursor {
  private layer: HTMLElement;
  private cursor: HTMLElement;
  private label: HTMLElement;
  private enabled = true;
  private pos: Point | null = null;
  private target: Element | null = null;
  /** Bumped by every move and hide, so an older glide stops when a newer one starts. */
  private seq = 0;
  private frame = 0;

  constructor(root: ShadowRoot, private opts: GhostCursorOptions = {}) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CURSOR_CSS);
    root.adoptedStyleSheets = [...(root.adoptedStyleSheets ?? []), sheet];

    this.layer = document.createElement('div');
    this.layer.className = opts.contained ? 'sk-gc-layer sk-gc-contained' : 'sk-gc-layer';
    this.layer.hidden = true;
    this.layer.setAttribute('aria-hidden', 'true');
    this.cursor = document.createElement('div');
    this.cursor.className = 'sk-gc';
    const ripple = document.createElement('div');
    ripple.className = 'sk-gc-ripple';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'sk-gc-arrow');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ARROW);
    svg.appendChild(path);
    this.label = document.createElement('div');
    this.label.className = 'sk-gc-label';
    // The arrow's tip is 2px into the box; the box is placed so the tip lands on the point.
    this.cursor.style.marginLeft = this.cursor.style.marginTop = '-2px';
    this.cursor.append(ripple, svg, this.label);
    this.layer.appendChild(this.cursor);
    (opts.parent ?? root).appendChild(this.layer);
  }

  /** Accent, the assistant's name for the label, and whether the team has it switched on. */
  setTheme(theme: { accent?: string; label?: string; enabled?: boolean }) {
    this.layer.style.setProperty('--sk-gc-accent', theme.accent || DEFAULT_ACCENT);
    if (theme.label !== undefined) this.label.textContent = theme.label.slice(0, 40);
    if (theme.enabled !== undefined) {
      this.enabled = theme.enabled;
      if (!this.isOn()) this.hide();
    }
  }

  /** Switched on, and the visitor has a mouse. In the dashboard preview the setting alone decides. */
  isOn(): boolean {
    return this.enabled && (!!this.opts.contained || !touchOnly());
  }

  /**
   * Glides to the control and resolves once it's there (or straight away when the cursor is off).
   * Scrolls the control into view first, and waits for the scroll to finish so it doesn't chase a
   * moving target. Resolves to false when another move or a hide took over on the way.
   */
  async moveTo(el: Element): Promise<boolean> {
    if (!this.isOn()) return true;
    const token = ++this.seq;
    this.target = el;
    cancelAnimationFrame(this.frame);
    this.cursor.classList.remove('sk-gc-resting');
    if (!this.opts.contained && !visibleInViewport(el)) {
      el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
    }
    await stillFor(el);
    if (token !== this.seq || !el.isConnected) return false;

    const from = this.pos ?? this.start();
    this.layer.hidden = false;
    const distance = Math.hypot(this.pointFor(el).x - from.x, this.pointFor(el).y - from.y);
    const duration = reducedMotion() ? 0 : Math.round(Math.min(900, Math.max(400, 380 + distance * 0.55)));
    await new Promise<void>((done) => {
      const began = performance.now();
      const step = (now: number) => {
        if (token !== this.seq) return done();
        // Recomputed every frame, so a control that's still settling is followed, not missed.
        const to = this.pointFor(el);
        const t = duration ? Math.min(1, (now - began) / duration) : 1;
        const k = easeOut(t);
        this.place({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
        if (t < 1) this.frame = requestAnimationFrame(step);
        else done();
      };
      if (duration) this.frame = requestAnimationFrame(step);
      else step(performance.now());
    });
    if (token !== this.seq) return false;
    this.follow(token);
    return true;
  }

  /** A small press on the control, before Skavelo clicks it for the visitor. */
  async press(): Promise<void> {
    if (!this.isOn() || this.layer.hidden) return;
    this.cursor.classList.remove('sk-gc-press');
    // Restarts the animation when two presses come close together.
    void this.cursor.offsetWidth;
    this.cursor.classList.add('sk-gc-press');
    await wait(reducedMotion() ? 0 : 180);
    window.setTimeout(() => this.cursor.classList.remove('sk-gc-press'), 300);
  }

  /** Guided steps: after showing the way it fades, so the visitor makes the click themselves. */
  rest() {
    this.cursor.classList.add('sk-gc-resting');
  }

  /** Gone until the next walkthrough, which glides from the launcher again. */
  hide() {
    this.seq++;
    cancelAnimationFrame(this.frame);
    this.target = null;
    this.pos = null;
    this.layer.hidden = true;
    this.cursor.classList.remove('sk-gc-resting', 'sk-gc-press');
  }

  destroy() {
    this.hide();
    this.layer.remove();
  }

  /** Where the arrow's tip is, relative to the layer; null while hidden. For tests and the preview. */
  position(): Point | null {
    return this.layer.hidden ? null : this.pos && this.toLayer(this.pos);
  }

  /** Stays on the control while it moves, like a row that shifts when the list above it loads. */
  private follow(token: number) {
    const tick = () => {
      if (token !== this.seq || !this.target?.isConnected) return;
      const to = this.pointFor(this.target);
      if (!this.pos || Math.abs(to.x - this.pos.x) > 0.5 || Math.abs(to.y - this.pos.y) > 0.5) this.place(to);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  /**
   * The tip rests just inside the control's bottom right corner, so the arrow and its label hang
   * off the corner instead of covering the control's text.
   */
  private pointFor(el: Element): Point {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + Math.max(r.width / 2, r.width - Math.min(12, r.width * 0.2)),
      y: r.top + Math.max(r.height / 2, r.height - Math.min(7, r.height * 0.2)),
    };
  }

  private start(): Point {
    const o = this.opts.origin?.();
    if (o) return o;
    const box = this.box();
    return { x: box.left + box.width / 2, y: box.top + box.height - 40 };
  }

  private box() {
    return this.opts.contained
      ? this.layer.getBoundingClientRect()
      : { top: 0, left: 0, width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
  }

  private toLayer(p: Point): Point {
    const box = this.box();
    return { x: p.x - box.left, y: p.y - box.top };
  }

  private place(p: Point) {
    this.pos = p;
    const at = this.toLayer(p);
    this.cursor.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
  }
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function wait(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}

function reducedMotion(): boolean {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** A phone or tablet with no mouse. */
export function touchOnly(): boolean {
  return !!window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
}

function visibleInViewport(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
}

/** Resolves once the control has stopped moving (a smooth scroll, a sliding drawer), or after 900ms. */
function stillFor(el: Element): Promise<void> {
  return new Promise((done) => {
    let last = '';
    let same = 0;
    const began = performance.now();
    const check = () => {
      const r = el.getBoundingClientRect();
      const key = `${Math.round(r.top)}|${Math.round(r.left)}`;
      same = key === last ? same + 1 : 0;
      last = key;
      if (same >= 2 || performance.now() - began > 900 || !el.isConnected) done();
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}
