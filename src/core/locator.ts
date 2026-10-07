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

export function isFreshEnough(score: number): boolean {
  return score >= SCORE_THRESHOLD;
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
          document.querySelector(`[data-testid="${CSS.escape(loc.value)}"]`) ??
          document.querySelector(`[data-cy="${CSS.escape(loc.value)}"]`) ??
          document.querySelector(`[data-test="${CSS.escape(loc.value)}"]`)
        );
      case 'text':
        return findByText(loc.value);
      case 'attr': {
        // Format: "attr=value"
        const eqIdx = loc.value.indexOf('=');
        if (eqIdx < 0) return null;
        const attr = loc.value.slice(0, eqIdx);
        const val = loc.value.slice(eqIdx + 1);
        return document.querySelector(`[${CSS.escape(attr)}="${CSS.escape(val)}"]`);
      }
      case 'css':
        return document.querySelector(loc.value);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function findByAriaRoleAndName(role: string, name: string): Element | null {
  // aria-label match
  const byLabel = document.querySelector(`[role="${role}"][aria-label="${CSS.escape(name)}"]`);
  if (byLabel) return byLabel;

  // aria-labelledby match — look for elements whose referenced label contains the name
  const candidates = document.querySelectorAll(`[role="${role}"]`);
  for (const el of candidates) {
    const computed = computedAriaLabel(el);
    if (computed.toLowerCase() === name.toLowerCase()) return el;
  }

  // Fallback: native elements with matching accessible name
  const nativeMap: Record<string, string> = {
    button: 'button',
    link: 'a',
    textbox: 'input,textarea',
    checkbox: 'input[type=checkbox]',
    radio: 'input[type=radio]',
  };
  const selector = nativeMap[role];
  if (selector) {
    const nativeCandidates = document.querySelectorAll(selector);
    for (const el of nativeCandidates) {
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

  return (el as HTMLElement).innerText?.trim() ?? '';
}

function findByText(text: string): Element | null {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  const normalised = text.toLowerCase().trim();
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const el = node as HTMLElement;
    const elText = el.innerText?.trim().toLowerCase();
    if (elText === normalised && isInteractiveLike(el)) return el;
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

function isVisible(el: Element): boolean {
  const htmlEl = el as HTMLElement;
  const style = window.getComputedStyle(htmlEl);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = htmlEl.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
