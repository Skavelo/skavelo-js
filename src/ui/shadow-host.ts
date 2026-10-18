/**
 * Creates and manages the Shadow DOM host for the Skavelo widget.
 * All widget HTML/CSS lives inside the shadow root so host styles cannot
 * interfere and our styles cannot leak out.
 */
/** Events that page libraries use to dismiss modals and menus ("click outside", Escape, focus leaving). */
const ISOLATED_EVENTS = [
  'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend',
  'keydown', 'keyup', 'keypress', 'focusin', 'focusout',
] as const;
const stop = (e: Event) => e.stopPropagation();

export class ShadowHost {
  private host: HTMLElement;
  private shadow: ShadowRoot;

  constructor() {
    this.host = document.createElement('div');
    this.host.id = 'skavelo-root';
    this.host.style.cssText = [
      'position: fixed',
      'z-index: 2147483647',
      'pointer-events: none',
      'inset: 0',
      'width: 0',
      'height: 0',
    ].join(';');

    this.shadow = this.host.attachShadow({ mode: 'closed' });
    // Clicks, keys and focus inside the widget stay inside it. Otherwise the host page sees them
    // as happening outside its own modal or menu (the widget isn't inside it), and closes it:
    // a click on the widget's close button, or Escape pressed in the widget.
    for (const type of ISOLATED_EVENTS) this.host.addEventListener(type, stop);
    document.documentElement.appendChild(this.host);
  }

  getRoot(): ShadowRoot {
    return this.shadow;
  }

  injectStyles(css: string) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    this.shadow.adoptedStyleSheets = [sheet];
  }

  destroy() {
    this.host.remove();
  }
}
