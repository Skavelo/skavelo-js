import { isFreshEnough, isVisible, resolveLocator } from './locator';
import type { Locator } from '../types';

// What menu buttons are called: "Menu", "Open menu", "Toggle navigation", "Show sidebar".
const MENU = /\b(menu|navigation|nav|sidebar|drawer)\b/i;
const NAV_AREA = 'nav, aside, header, [role="navigation"], [role="banner"], [role="dialog"]';
const BUTTONS = 'button, [role="button"], summary, [aria-expanded]';

/** The phone menu buttons learning recorded for this app, from the widget's settings. */
let knownMenus: Locator[][] = [];

export function setKnownMenus(menus: { locators: Locator[] }[] | undefined) {
  knownMenus = (menus ?? []).map((m) => m.locators).filter((l) => l.length);
}

/**
 * The menu button known for certain: one the site marked with data-sk-menu, then the one learning
 * saw open the navigation at phone width. Only if it's on screen and closed.
 */
function exactMenu(target?: Element): { el: Element; label: string } | null {
  const marked = Array.from(document.querySelectorAll('[data-sk-menu]')).find(
    (b) => b.getAttribute('aria-expanded') !== 'true' && isVisible(b) && !(target && b.contains(target)),
  );
  return marked ? named(marked) : knownMenu(target);
}

/** A recorded menu button that's on screen and closed, if there is one. */
function knownMenu(target?: Element): { el: Element; label: string } | null {
  for (const locators of knownMenus) {
    const { el, score } = resolveLocator(locators);
    if (!el || !isFreshEnough(score)) continue;
    if (el.getAttribute('aria-expanded') === 'true' || (target && el.contains(target))) continue;
    if (isVisible(el)) return named(el);
  }
  return null;
}

/**
 * The visible button that shows a hidden control, like the menu button a phone layout puts the
 * sidebar behind. Found from what the page says first (aria-controls, a closed <details>), then,
 * for a control in a sidebar or menu, a button named like a menu. Null when there's none.
 */
export function revealerOf(target: Element): { el: Element; label: string } | null {
  // A button that says which element it opens, when that element holds the control.
  for (let node: Element | null = target; node; node = node.parentElement) {
    if (!node.id) continue;
    for (const b of Array.from(document.querySelectorAll('[aria-controls]'))) {
      const ids = (b.getAttribute('aria-controls') ?? '').split(/\s+/);
      if (ids.includes(node.id) && isVisible(b) && !b.contains(target)) return named(b);
    }
  }

  // A closed <details>: its summary opens it.
  const details = target.closest('details:not([open])');
  const summary = details?.querySelector(':scope > summary');
  if (summary && isVisible(summary)) return named(summary);

  // In the sidebar or top bar: the menu button the site marked, or the one learning saw open it.
  if (target.closest(NAV_AREA)) {
    const menu = exactMenu(target);
    if (menu) return menu;
  }

  // A closed toggle right beside it, like a dropdown's button next to its list. Inside a sidebar or
  // top bar the search stays there: a dropdown elsewhere on the page, like a "Try it" menu in the
  // content, doesn't open the sidebar.
  const area = target.closest(NAV_AREA);
  let near = target.parentElement;
  for (let depth = 0; near && near !== document.body && depth < 4; depth++, near = near.parentElement) {
    const toggle = Array.from(near.querySelectorAll('[aria-expanded="false"]')).find(
      (b) => isVisible(b) && !b.contains(target),
    );
    if (toggle) return named(toggle);
    if (near === area) break;
  }

  // A sidebar or menu link: the page's menu button.
  return area ? menuButton(target) : null;
}

/**
 * The page's closed menu button, like the ☰ on a phone layout. Also for menus whose links only
 * join the page once it opens, when there's nothing hidden to start from.
 */
export function menuButton(target?: Element): { el: Element; label: string } | null {
  const exact = exactMenu(target);
  if (exact) return exact;
  const usable = (b: Element) =>
    b.getAttribute('aria-expanded') !== 'true' && isVisible(b) && !(target && b.contains(target));

  const buttons = Array.from(document.querySelectorAll(BUTTONS)).filter(usable);
  for (const b of buttons) {
    // An icon button is often named only by its class, like "nav-toggle".
    const name = nameOf(b);
    if (MENU.test(name) || (!name && MENU.test(String(b.getAttribute('class') ?? '')))) return named(b);
  }
  // Last, the usual ☰: an unlabelled icon button near the top that opens something.
  const top = window.innerHeight * 0.15;
  const icon = buttons.find(
    (b) => b.hasAttribute('aria-expanded') && !nameOf(b) && b.getBoundingClientRect().top < top && !!b.querySelector('svg, img, i, span'),
  );
  return icon ? named(icon) : null;
}

/**
 * How a step names the button: its own short name when it has one, like **Settings**, and "the
 * menu" for an icon or a generic "Toggle navigation".
 */
export function revealInstruction(label: string): string {
  return label && !MENU.test(label) && label.length <= 30 ? `Open **${label}** first.` : 'Open the menu first.';
}

function named(el: Element) {
  return { el, label: nameOf(el) };
}

function nameOf(el: Element): string {
  return (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.getAttribute('title') || '')
    .replace(/\s+/g, ' ')
    .trim();
}
