import type { Locator } from '../types';

const SCORE_THRESHOLD = 0.5;

/**
 * Resolves a ranked set of locators to a live DOM element.
 * Returns null and a score below the threshold if no reliable match is found —
 * callers should mark the step stale rather than highlight the wrong element.
 */
export function resolveLocator(locators: Locator[]): { el: Element | null; score: number } {
  const sorted = [...locators].sort((a, b) => b.score - a.score);

  for (const loc of sorted) {
    const el = findByLocator(loc);
    if (el && isVisible(el)) {
      return { el, score: loc.score };
    }
  }

  return { el: null, score: 0 };
}

/**
 * The step's control when it's in the page but not showing, like a sidebar link a phone layout
 * keeps behind a menu button. Only locators reliable enough to highlight count.
 */
export function findHidden(locators: Locator[]): Element | null {
  for (const loc of [...locators].sort((a, b) => b.score - a.score)) {
    if (!isFreshEnough(loc.score)) continue;
    const el = findByLocator(loc);
    if (el && !isVisible(el)) return el;
  }
  return null;
}

export function isFreshEnough(score: number): boolean {
  return score >= SCORE_THRESHOLD;
}

/**
 * Whether the user can reach it. With a modal open, the page behind it is marked aria-hidden or
 * inert, and may hold a button with the same name as the dialog's own, like a page's **Add
 * suggestion** behind the dialog's **Add suggestion**. Anything inert is out of reach too.
 */
function usable(el: Element): boolean {
  if (el.closest('[inert]')) return false;
  return !modalOpen() || !el.closest('[aria-hidden="true"]');
}

// Not every library sets aria-modal (Base UI hides the page with aria-hidden but doesn't), so any
// open dialog that isn't itself hidden counts.
function modalOpen(): boolean {
  try {
    if (document.querySelector('dialog:modal')) return true;
  } catch {
    // :modal isn't supported everywhere.
  }
  return Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog[open]')).some(
    (d) => !d.closest('[aria-hidden="true"], [inert]') && isVisible(d),
  );
}

/** The first element for a selector that the user can reach. */
function first(selector: string): Element | null {
  return Array.from(document.querySelectorAll(selector)).find(usable) ?? null;
}

function findByLocator(loc: Locator): Element | null {
  try {
    switch (loc.type) {
      case 'aria': {
        // Format: "role::name"
        const [role, ...nameParts] = loc.value.split('::');
        const name = nameParts.join('::');
        return findByAriaRoleAndName(role, name);
      }
      case 'testid':
        return (
          first(`[data-testid="${CSS.escape(loc.value)}"]`) ??
          first(`[data-cy="${CSS.escape(loc.value)}"]`) ??
          first(`[data-test="${CSS.escape(loc.value)}"]`)
        );
      case 'text':
        return findByText(loc.value);
      case 'attr': {
        // Format: "attr=value"
        const eqIdx = loc.value.indexOf('=');
        if (eqIdx < 0) return null;
        const attr = loc.value.slice(0, eqIdx);
        const val = loc.value.slice(eqIdx + 1);
        if (attr === 'href') return findByDestination(val);
        return first(`[${CSS.escape(attr)}="${CSS.escape(val)}"]`);
      }
      case 'css':
        return first(loc.value);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * A link to the page learning saw it go to, like /settings/billing or /invoices/:id, whatever its
 * label says here. One that's showing wins over one tucked in a closed menu.
 */
function findByDestination(pattern: string): Element | null {
  const trim = (p: string) => p.replace(/\/+$/, '') || '/';
  const [path, hash = ''] = pattern.split('#');
  const re = (p: string) =>
    new RegExp('^' + trim(p).split(':id').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]+') + '$');
  let hidden: Element | null = null;
  for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    let to: URL;
    try {
      to = new URL(a.href);
    } catch {
      continue;
    }
    if (to.origin !== location.origin || !re(path).test(trim(to.pathname))) continue;
    if (hash && !re(`#${hash}`).test(trim(to.hash))) continue;
    if (!usable(a)) continue;
    if (isVisible(a)) return a;
    hidden ??= a;
  }
  return hidden;
}

function findByAriaRoleAndName(role: string, name: string): Element | null {
  // aria-label match
  const byLabel = first(`[role="${role}"][aria-label="${CSS.escape(name)}"]`);
  if (byLabel) return byLabel;

  // aria-labelledby match — look for elements whose referenced label contains the name
  const candidates = document.querySelectorAll(`[role="${role}"]`);
  for (const el of candidates) {
    if (!usable(el)) continue;
    const computed = computedAriaLabel(el);
    if (computed.toLowerCase() === name.toLowerCase()) return el;
  }

  // Fallback: native elements with matching accessible name
  const nativeMap: Record<string, string> = {
    button: 'button',
    link: 'a',
    textbox: 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=hidden]),textarea',
    combobox: 'select',
    checkbox: 'input[type=checkbox]',
    radio: 'input[type=radio]',
  };
  const selector = nativeMap[role];
  if (selector) {
    const nativeCandidates = document.querySelectorAll(selector);
    for (const el of nativeCandidates) {
      if (!usable(el)) continue;
      const computed = computedAriaLabel(el);
      if (computed.toLowerCase() === name.toLowerCase()) return el;
    }
  }

  return null;
}

function computedAriaLabel(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ');
  }

  const id = el.id;
  if (id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`);
    if (label) return label.textContent?.trim() ?? '';
  }

  const wrap = el.closest('label');
  if (wrap?.textContent?.trim()) return wrap.textContent.trim();
  const text = (el as HTMLElement).innerText?.trim();
  if (text) return text;
  if (el.matches(FIELDS)) {
    const near = nearbyLabel(el);
    if (near) return near;
  }
  return (el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('name') || '').trim();
}

const FIELDS = 'input, textarea, select, [role="combobox"], [role="textbox"], [role="switch"], [role="checkbox"]';
const CONTROLS = 'input, textarea, select, button, [role="switch"], [role="checkbox"], [role="combobox"]';

/**
 * A field whose label isn't tied to it, like <label>Street address</label><input>: the short text
 * just before it. The same rule learning uses to name fields (backend crawler.ts labelFor), so a
 * field it recorded as "Street address" is found here by that name. Never climbs into a box holding
 * other fields, where the text before it belongs to the whole section.
 */
function nearbyLabel(el: Element): string {
  let node: Element | null = el;
  for (let depth = 0; node && depth < 3; depth++) {
    for (let prev = node.previousElementSibling; prev; prev = prev.previousElementSibling) {
      if (prev.querySelector(CONTROLS) || prev.matches(CONTROLS)) return '';
      const t = (prev as HTMLElement).innerText?.trim() ?? '';
      if (!t) continue;
      const lead = prev.children.length > 1 ? ((prev.firstElementChild as HTMLElement).innerText?.trim() ?? '') : '';
      if (lead && lead.length <= 40 && !lead.includes('\n')) return lead;
      const first = t.split('\n')[0].trim();
      return first && first.length <= 40 ? first : '';
    }
    const parent: Element | null = node.parentElement;
    if (!parent || parent.querySelectorAll(CONTROLS).length > 1) return '';
    node = parent;
  }
  return '';
}

function findByText(text: string): Element | null {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  const normalised = text.toLowerCase().trim();
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const el = node as HTMLElement;
    const elText = el.innerText?.trim().toLowerCase();
    if (elText === normalised && isInteractiveLike(el) && usable(el)) return el;
  }
  return null;
}

function isInteractiveLike(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return true;
  const role = el.getAttribute('role')?.toLowerCase() ?? '';
  if (['button', 'link', 'menuitem', 'option', 'tab'].includes(role)) return true;
  return false;
}

export function isVisible(el: Element): boolean {
  const htmlEl = el as HTMLElement;
  const style = window.getComputedStyle(htmlEl);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = htmlEl.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
