/**
 * Notices when a visitor seems stuck, from what they do on the page:
 * - pressing a switched off button again, like Create campaign before setup is finished;
 * - the same error showing up a second time, like a form refused twice for the same reason;
 * - pressing the same control over and over when nothing seems to happen.
 * Nothing is sent anywhere: it only offers the widget's help. Text inside data-sk-sensitive,
 * password fields and the widget itself is never read.
 */

export type StuckSignal =
  | { kind: 'disabled'; label: string; reason?: string }
  | { kind: 'error'; text: string }
  | { kind: 'repeat'; label: string };

export const PRESSABLE = 'button, a[href], [role="button"], [role="menuitem"], [role="tab"], input[type="submit"], input[type="button"], summary';
export const ERRORS = '[role="alert"], [aria-live="assertive"], [data-sonner-toast][data-type="error"], .error, .alert-error, [aria-invalid="true"]';
const DISABLED_AGAIN_MS = 20_000;
const ERROR_AGAIN_MS = 5 * 60_000;
const REPEAT_PRESSES = 5;
const REPEAT_WINDOW_MS = 3_000;
/** At most this often: reading error text makes the browser lay the page out again. */
const SCAN_EVERY_MS = 400;
// Steppers and the like are meant to be pressed many times.
const MEANT_TO_REPEAT = /^[+\-−–]$|increase|decrease|increment|decrement|next|previous|prev|more|zoom|undo|redo|›|‹|»|«/i;

export function labelOf(el: Element): string {
  const own = el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.getAttribute('title')
    || (el instanceof HTMLInputElement ? el.value : '') || '';
  return own.replace(/\s+/g, ' ').trim().slice(0, 60);
}

export function isDisabled(el: Element): boolean {
  return (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true'
    || !!el.closest('fieldset[disabled]');
}

export function hidden(el: Element): boolean {
  return !!el.closest('[data-sk-sensitive], [data-skavelo-host], #skavelo-root');
}

/** The tooltip or note a disabled control points to, if any: "Verify your domain first". */
export function reasonFor(el: Element): string | undefined {
  const ids = el.getAttribute('aria-describedby')?.split(/\s+/) ?? [];
  const described = ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
  const text = described || el.getAttribute('title') || el.closest('[title]')?.getAttribute('title') || '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 140) || undefined;
}

/** What an error says: the element's own text, or for an invalid field, the message tied to it. */
export function errorText(el: Element): string {
  if (el.getAttribute('aria-invalid') === 'true') {
    const ids = `${el.getAttribute('aria-errormessage') ?? ''} ${el.getAttribute('aria-describedby') ?? ''}`.trim().split(/\s+/).filter(Boolean);
    return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ').replace(/\s+/g, ' ').trim().slice(0, 140);
  }
  return ((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);
}

export class StuckWatcher {
  private presses = new Map<Element, number[]>();
  private disabledAt = new Map<Element, number>();
  private errorsSeen = new Map<string, number>();
  private visible = new Set<string>();
  private observer: MutationObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private onStuck: (signal: StuckSignal) => void, private now: () => number = () => Date.now()) {}

  start() {
    document.addEventListener('pointerdown', this.onPress, true);
    // A busy page changes many times a second; scan once the changes pause, at most every SCAN_EVERY_MS.
    this.observer = new MutationObserver(() => {
      if (this.timer) return;
      this.timer = setTimeout(() => {
        this.timer = null;
        this.scanErrors();
      }, SCAN_EVERY_MS);
    });
    this.observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-invalid', 'role', 'hidden', 'class'],
    });
    this.scanErrors();
  }

  stop() {
    document.removeEventListener('pointerdown', this.onPress, true);
    this.observer?.disconnect();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private onPress = (e: Event) => {
    const target = e.target instanceof Element ? e.target.closest(PRESSABLE) : null;
    if (!target || hidden(target)) return;
    const label = labelOf(target);
    if (!label) return;
    const t = this.now();

    if (isDisabled(target)) {
      const before = this.disabledAt.get(target);
      this.disabledAt.set(target, t);
      if (before !== undefined && t - before <= DISABLED_AGAIN_MS) {
        this.disabledAt.delete(target);
        this.onStuck({ kind: 'disabled', label, reason: reasonFor(target) });
      }
      return;
    }

    if (MEANT_TO_REPEAT.test(label)) return;
    const recent = (this.presses.get(target) ?? []).filter((p) => t - p <= REPEAT_WINDOW_MS);
    recent.push(t);
    this.presses.set(target, recent);
    if (recent.length >= REPEAT_PRESSES) {
      this.presses.delete(target);
      this.onStuck({ kind: 'repeat', label });
    }
  };

  /** An error counts again only after it went away and came back, or showed up as a new element. */
  scanErrors() {
    const now = new Set<string>();
    for (const el of Array.from(document.querySelectorAll(ERRORS))) {
      if (hidden(el) || (el as HTMLElement).hidden) continue;
      const text = errorText(el);
      if (text.length < 4) continue;
      now.add(text);
      if (this.visible.has(text)) continue;
      const before = this.errorsSeen.get(text);
      const t = this.now();
      this.errorsSeen.set(text, t);
      if (before !== undefined && t - before <= ERROR_AGAIN_MS) {
        this.errorsSeen.delete(text);
        this.onStuck({ kind: 'error', text });
      }
    }
    this.visible = now;
  }
}

/** The chip the visitor sees, and the fuller question Skavelo is asked if they click it. */
export function helpFor(signal: StuckSignal): { chip: string; question: string } {
  switch (signal.kind) {
    case 'disabled':
      return {
        chip: `Why can't I use “${signal.label}”?`,
        question: `Why can't I use "${signal.label}"? It's switched off for me on this page.${signal.reason ? ` It says: "${signal.reason}".` : ''}`,
      };
    case 'error':
      return {
        chip: `Help with “${signal.text.length > 48 ? `${signal.text.slice(0, 46)}…` : signal.text}”`,
        question: `I keep getting this message: "${signal.text}". What does it mean, and how do I fix it?`,
      };
    case 'repeat':
      return {
        chip: `Is “${signal.label}” not working?`,
        question: `I pressed "${signal.label}" several times and nothing seemed to happen. What should I do?`,
      };
  }
}
