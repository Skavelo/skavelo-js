/**
 * Doing a walkthrough for the visitor: entering the values they gave and clicking through to the
 * form. Only native fields are filled, and only clicks that can't change anything are made: the
 * last step, and anything labelled like saving, sending or deleting, is always left to the visitor.
 */

/** Labels of controls that change something. These are never clicked for the visitor. */
const CHANGES = /\b(save|send|submit|create|delete|remove|pay|purchase|buy|checkout|publish|confirm|invite|activate|deactivate|pause|resume|archive|cancel|upgrade|downgrade|import|apply|approve|reject|transfer|refund|charge|launch|schedule|enable|disable|update|reset|duplicate|restore|void|unsubscribe|disconnect|connect|sign ?out|log ?out|finish|done|ok)\b/i;

function labelOf(el: Element): string {
  const own = el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.getAttribute('title') || '';
  const value = el instanceof HTMLInputElement && (el.type === 'submit' || el.type === 'button') ? el.value : '';
  return `${own} ${value}`.replace(/\s+/g, ' ').trim();
}

/** A click that only moves somewhere or opens something: a link, tab, menu or a button like "New invoice". */
export function canClickFor(el: Element): boolean {
  if (CHANGES.test(labelOf(el))) return false;
  if (el instanceof HTMLInputElement && el.type === 'submit') return false;
  if (el instanceof HTMLButtonElement && el.type === 'submit' && el.form) return false;
  if (el.matches('input, select, textarea')) return false;
  return el.matches('a[href], button, summary, [role="tab"], [role="link"], [role="button"], [role="menuitem"], [aria-haspopup]');
}

/**
 * Enters a value the way typing would, so frameworks like React see the change. Returns false
 * when the field can't be filled this way (a custom dropdown, an unknown option, a badly formed
 * date), and the step is left for the visitor.
 */
export function fillField(el: Element, value: string): boolean {
  if (el instanceof HTMLInputElement) {
    if (el.disabled || el.readOnly) return false;
    if (el.type === 'checkbox' || el.type === 'radio') {
      const want = /^(on|true|yes|1|checked)$/i.test(value.trim());
      if (el.checked !== want) el.click();
      else el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (el.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    if (['file', 'password', 'hidden', 'submit', 'button', 'image', 'reset'].includes(el.type)) return false;
    return type(el, HTMLInputElement.prototype, value);
  }
  if (el instanceof HTMLTextAreaElement) {
    if (el.disabled || el.readOnly) return false;
    return type(el, HTMLTextAreaElement.prototype, value);
  }
  if (el instanceof HTMLSelectElement) {
    if (el.disabled) return false;
    const want = value.trim().toLowerCase();
    const options = Array.from(el.options);
    const match = options.find((o) => o.text.trim().toLowerCase() === want || o.value.toLowerCase() === want)
      ?? options.find((o) => o.text.trim().toLowerCase().includes(want));
    if (!match) return false;
    return type(el, HTMLSelectElement.prototype, match.value);
  }
  return false;
}

function type(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, proto: object, value: string): boolean {
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  el.focus();
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/** "Click **Send invoice**." becomes "Check the details, then click **Send invoice**." */
export function checkThen(instruction: string): string {
  const rest = instruction.charAt(0).toLowerCase() + instruction.slice(1);
  return `Check the details, then ${rest}`;
}
