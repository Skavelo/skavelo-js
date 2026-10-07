import type { ElementDescriptor } from '../types';

/** Interactive ARIA roles that should always be included */
const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
  'option', 'radio', 'checkbox', 'textbox', 'combobox', 'listbox',
  'searchbox', 'spinbutton', 'slider', 'switch', 'tab',
]);

const INTERACTIVE_TAGS = new Set([
  'BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA',
]);

/** Tags whose content is definitely sensitive — never send their text */
const SENSITIVE_TAGS = new Set(['INPUT', 'TEXTAREA']);

/** Max elements to include in a single payload (spec: "trimmed element list") */
const MAX_ELEMENTS = 150;

/**
 * Scans the live DOM and returns a trimmed list of visible, meaningful elements.
 * Never includes what people typed: input and textarea values, or text in rich text editors.
 * Password fields, editable regions and anything inside data-sk-sensitive are masked
 * (role and "masked" only).
 */
export function scanPage(): ElementDescriptor[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const results: ElementDescriptor[] = [];

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
  );

  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    if (results.length >= MAX_ELEMENTS) break;

    const el = node as HTMLElement;

    // Skip invisible elements
    if (!isVisible(el)) continue;

    // Skip shadow hosts — their internals are scanned separately
    if (el.shadowRoot) continue;

    const tag = el.tagName;
    const role = (el.getAttribute('role') ?? inferRole(el)).toLowerCase();
    // Passwords, rich text editors (what someone typed) and anything the site marks private.
    const isSensitive =
      (tag === 'INPUT' && (el as HTMLInputElement).type === 'password') ||
      el.isContentEditable ||
      !!el.closest('[data-sk-sensitive]');

    const interactive = isInteractive(el, role);
    if (!interactive && !hasSignificantText(el)) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;

    const name = isSensitive
      ? 'masked'
      : getAccessibleName(el);

    const text = isSensitive
      ? ''
      : SENSITIVE_TAGS.has(tag)
        ? ''
        : getVisibleText(el);

    results.push({
      role: role || 'generic',
      name: name || undefined,
      text: text || undefined,
      x: +(rect.left / vw).toFixed(3),
      y: +(rect.top / vh).toFixed(3),
      w: +(rect.width / vw).toFixed(3),
      h: +(rect.height / vh).toFixed(3),
      interactive,
    });
  }

  return results;
}

function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) < 0.1) return false;
  const rect = el.getBoundingClientRect();
  // Must overlap the viewport at least partially
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

function isInteractive(el: HTMLElement, role: string): boolean {
  if (INTERACTIVE_TAGS.has(el.tagName)) return true;
  if (INTERACTIVE_ROLES.has(role)) return true;
  if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') return true;
  if (el.hasAttribute('onclick')) return true;
  return false;
}

function inferRole(el: HTMLElement): string {
  const tag = el.tagName;
  const type = el.getAttribute('type')?.toLowerCase();
  if (tag === 'BUTTON') return 'button';
  if (tag === 'A' && el.hasAttribute('href')) return 'link';
  if (tag === 'INPUT') {
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (type === 'submit' || type === 'button') return 'button';
    return 'textbox';
  }
  if (tag === 'SELECT') return 'combobox';
  if (tag === 'TEXTAREA') return 'textbox';
  if (tag === 'NAV') return 'navigation';
  if (tag === 'MAIN') return 'main';
  if (/^H[1-6]$/.test(tag)) return 'heading';
  return '';
}

function getAccessibleName(el: HTMLElement): string {
  // aria-label takes highest priority
  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;

  // aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ');
    if (label) return label;
  }

  // <label for="...">
  const id = el.id;
  if (id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`);
    if (label) return label.textContent?.trim() ?? '';
  }

  // Inputs are named by their placeholder, never by their value
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    return (el as HTMLInputElement).placeholder?.trim() ?? '';
  }

  // title
  const title = el.getAttribute('title')?.trim();
  if (title) return title;

  return '';
}

function getVisibleText(el: HTMLElement): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function hasSignificantText(el: HTMLElement): boolean {
  const text = getVisibleText(el);
  return text.length > 3;
}
