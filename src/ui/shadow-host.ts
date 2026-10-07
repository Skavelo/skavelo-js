/**
 * Creates and manages the Shadow DOM host for the Skavelo widget.
 * All widget HTML/CSS lives inside the shadow root so host styles cannot
 * interfere and our styles cannot leak out.
 */
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
