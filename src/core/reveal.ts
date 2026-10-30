import { isVisible } from './locator';

// What menu buttons are called: "Menu", "Open menu", "Toggle navigation", "Show sidebar".
const MENU = /\b(menu|navigation|nav|sidebar|drawer)\b/i;
const NAV_AREA = 'nav, aside, header, [role="navigation"], [role="banner"], [role="dialog"]';
const BUTTONS = 'button, [role="button"], summary, [aria-expanded]';

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

  // A closed toggle right beside it, like a dropdown's button next to its list.
  let near = target.parentElement;
  for (let depth = 0; near && near !== document.body && depth < 4; depth++, near = near.parentElement) {
    const toggle = Array.from(near.querySelectorAll('[aria-expanded="false"]')).find(
      (b) => isVisible(b) && !b.contains(target),
    );
    if (toggle) return named(toggle);
  }

  // A sidebar or menu link: the page's menu button.
  return target.closest(NAV_AREA) ? menuButton(target) : null;
}

/**
 * The page's closed menu button, like the ☰ on a phone layout. Also for menus whose links only
 * join the page once it opens, when there's nothing hidden to start from.
 */
export function menuButton(target?: Element): { el: Element; label: string } | null {
  const usable = (b: Element) =>
    b.getAttribute('aria-expanded') !== 'true' && isVisible(b) && !(target && b.contains(target));
  // The site marked it: <button data-sk-menu>.
  const marked = Array.from(document.querySelectorAll('[data-sk-menu]')).find(usable);
  if (marked) return named(marked);

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
