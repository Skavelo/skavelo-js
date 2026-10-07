/**
 * Renders the step highlight ring around a target element.
 *
 * Highlight behaviour per brand guide:
 * - A claret ring (--signal colour) around the target element
 * - Animated "ring" keyframe — pulses twice then settles
 * - 280ms transition (slow token)
 * - No bounce easing
 * - Reduced motion: ring and dot simply appear (no pulse, no draw)
 */

const HIGHLIGHT_CSS = `
  :host { all: initial; }

  .sk-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 2147483646;
  }

  .sk-ring {
    position: absolute;
    border-radius: inherit;
    box-shadow:
      0 0 0 2px #fff,
      0 0 0 4px var(--sk-signal, #A3224A),
      0 0 0 4px color-mix(in srgb, var(--sk-signal, #A3224A) 35%, transparent);
    pointer-events: none;
    transition: top 280ms cubic-bezier(.2,.8,.2,1),
                left 280ms cubic-bezier(.2,.8,.2,1),
                width 280ms cubic-bezier(.2,.8,.2,1),
                height 280ms cubic-bezier(.2,.8,.2,1),
                border-radius 280ms cubic-bezier(.2,.8,.2,1);
    animation: sk-ring 2.2s ease-out 1;
  }

  @keyframes sk-ring {
    0%   { box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--sk-signal, #A3224A), 0 0 0 4px color-mix(in srgb, var(--sk-signal, #A3224A) 35%, transparent); }
    70%, 100% { box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--sk-signal, #A3224A), 0 0 0 12px transparent; }
  }

  @media (prefers-reduced-motion: reduce) {
    .sk-ring {
      animation: none;
      transition: none;
    }
  }

  .sk-scroll-btn {
    position: absolute;
    pointer-events: auto;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--sk-signal, #A3224A);
    color: #fff;
    font: 600 12px/1 'Instrument Sans', system-ui, sans-serif;
    border: none;
    cursor: pointer;
    white-space: nowrap;
  }
`;

export class HighlightOverlay {
  private container: HTMLElement;
  private ring: HTMLElement;
  private signal: string;

  constructor(shadowRoot: ShadowRoot, accent?: string) {
    this.signal = accent ?? '#A3224A';

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(HIGHLIGHT_CSS.replace(/var\(--sk-signal, #A3224A\)/g, `var(--sk-signal, ${this.signal})`));
    shadowRoot.adoptedStyleSheets = [
      ...(shadowRoot.adoptedStyleSheets ?? []),
      sheet,
    ];

    this.container = document.createElement('div');
    this.container.className = 'sk-overlay';
    this.container.style.setProperty('--sk-signal', this.signal);

    this.ring = document.createElement('div');
    this.ring.className = 'sk-ring';
    this.ring.hidden = true;
    this.container.appendChild(this.ring);

    shadowRoot.appendChild(this.container);
  }

  point(el: Element) {
    const isNewTarget = el !== this.target;
    this.target = el;
    this.ring.hidden = false;
    this.reposition();

    if (!isNewTarget) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    window.addEventListener('scroll', this.onViewportChange, true);
    window.addEventListener('resize', this.onViewportChange);

    // Re-trigger the pulse only when moving to a new element.
    this.ring.classList.remove('sk-ring');
    void this.ring.offsetWidth;
    this.ring.classList.add('sk-ring');
  }

  hide() {
    this.target = null;
    this.ring.hidden = true;
    window.removeEventListener('scroll', this.onViewportChange, true);
    window.removeEventListener('resize', this.onViewportChange);
  }

  destroy() {
    this.hide();
    this.container.remove();
  }

  private target: Element | null = null;
  private frame = 0;

  private onViewportChange = () => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.reposition());
  };

  // The overlay is position: fixed, so viewport coordinates are used as is.
  private reposition() {
    if (!this.target) return;
    const rect = this.target.getBoundingClientRect();
    const radius = window.getComputedStyle(this.target).borderRadius || '4px';
    Object.assign(this.ring.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      borderRadius: radius,
    });
  }
}
