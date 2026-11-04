// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { canClickFor, checkThen, fillField, typeField } from './fill';

const html = (markup: string) => {
  document.body.innerHTML = markup;
  return document.body.firstElementChild as Element;
};

describe('fillField', () => {
  it('types into a text field so frameworks see input and change', () => {
    const el = html('<input id="amount">') as HTMLInputElement;
    const seen: string[] = [];
    el.addEventListener('input', () => seen.push('input'));
    el.addEventListener('change', () => seen.push('change'));
    expect(fillField(el, '500')).toBe(true);
    expect(el.value).toBe('500');
    expect(seen).toEqual(['input', 'change']);
  });

  it('chooses a dropdown option by its label', () => {
    const el = html('<select><option value="b1">Brightline Ltd</option><option value="h2">Harbor &amp; Co</option></select>') as HTMLSelectElement;
    expect(fillField(el, 'harbor & co')).toBe(true);
    expect(el.value).toBe('h2');
  });

  it("leaves a dropdown alone when the option isn't there", () => {
    const el = html('<select><option>USD</option></select>') as HTMLSelectElement;
    expect(fillField(el, 'JPY')).toBe(false);
  });

  it('only takes dates as YYYY-MM-DD', () => {
    const el = html('<input type="date">') as HTMLInputElement;
    expect(fillField(el, 'Nov 30')).toBe(false);
    expect(fillField(el, '2026-11-30')).toBe(true);
    expect(el.value).toBe('2026-11-30');
  });

  it('switches a checkbox to the state asked for, and leaves it if it is already there', () => {
    const el = html('<input type="checkbox">') as HTMLInputElement;
    const change = vi.fn();
    el.addEventListener('change', change);
    expect(fillField(el, 'on')).toBe(true);
    expect(el.checked).toBe(true);
    expect(fillField(el, 'on')).toBe(true);
    expect(el.checked).toBe(true);
    expect(change).toHaveBeenCalledTimes(2);
  });

  it('never fills passwords, files or custom widgets', () => {
    expect(fillField(html('<input type="password">'), 'x')).toBe(false);
    expect(fillField(html('<input type="file">'), 'x')).toBe(false);
    expect(fillField(html('<div role="combobox">Pick</div>'), 'x')).toBe(false);
  });
});

describe('canClickFor', () => {
  it('clicks links, tabs and buttons that open things', () => {
    expect(canClickFor(html('<a href="/invoices">Invoices</a>'))).toBe(true);
    expect(canClickFor(html('<button>New invoice</button>'))).toBe(true);
    expect(canClickFor(html('<div role="tab">Paused</div>'))).toBe(true);
    expect(canClickFor(html('<button aria-haspopup="menu" aria-label="Open menu">⋯</button>'))).toBe(true);
  });

  it('never clicks anything that saves, sends or deletes', () => {
    for (const label of ['Send invoice', 'Save draft', 'Delete', 'Pay now', 'Invite teammate', 'Pause journey', 'Confirm']) {
      expect(canClickFor(html(`<button>${label}</button>`))).toBe(false);
    }
    expect(canClickFor(html('<form><button type="submit">Go</button></form>').querySelector('button')!)).toBe(false);
  });

  it('presses an action-named button that learning saw open something', () => {
    expect(canClickFor(html('<button>Invite teammate</button>'), { opens: true })).toBe(true);
  });

  it('presses an action-named button that says it opens a dialog or panel', () => {
    expect(canClickFor(html('<button aria-haspopup="dialog">Invite teammate</button>'))).toBe(true);
    expect(canClickFor(html('<button aria-haspopup="true">Share</button>'))).toBe(true);
    expect(canClickFor(html('<button aria-expanded="false" aria-controls="export-panel">Export</button>'))).toBe(true);
  });

  it('still leaves deleting, cancelling and paying to the visitor, popup or not', () => {
    for (const label of ['Delete workspace', 'Cancel subscription', 'Pay now', 'Remove member']) {
      expect(canClickFor(html(`<button aria-haspopup="dialog">${label}</button>`))).toBe(false);
    }
    expect(canClickFor(html('<button aria-haspopup="false">Send</button>'))).toBe(false);
    expect(canClickFor(html('<button aria-expanded="false">Send</button>'))).toBe(false);
    expect(canClickFor(html('<form><button aria-haspopup="dialog">Invite</button></form>').querySelector('button')!)).toBe(false);
  });
});

it('turns the last instruction into a check', () => {
  expect(checkThen('Click **Send invoice**.')).toBe('Check the details, then click **Send invoice**.');
});

describe('typeField', () => {
  it('types a little at a time, the way the visitor would, and finishes the step once', async () => {
    const input = html('<input type="text">') as HTMLInputElement;
    const seen: string[] = [];
    let changes = 0;
    input.addEventListener('input', () => seen.push(input.value));
    input.addEventListener('change', () => changes++);
    expect(await typeField(input, 'Ada Lovelace')).toBe(true);
    expect(input.value).toBe('Ada Lovelace');
    expect(seen.length).toBeGreaterThan(3);
    expect(seen[0].length).toBeLessThan('Ada Lovelace'.length);
    expect(changes).toBe(1);
  });

  it('enters it in one go when asked, and for dropdowns', async () => {
    const input = html('<input type="text">') as HTMLInputElement;
    let inputs = 0;
    input.addEventListener('input', () => inputs++);
    await typeField(input, 'Ada Lovelace', { instant: true });
    expect(inputs).toBe(1);
    const select = html('<select><option value="m">Member</option><option value="a">Admin</option></select>') as HTMLSelectElement;
    expect(await typeField(select, 'Admin')).toBe(true);
    expect(select.value).toBe('a');
  });

  it("stops when the field leaves the page", async () => {
    const input = html('<input type="text">') as HTMLInputElement;
    input.addEventListener('input', () => input.remove());
    expect(await typeField(input, 'a long value to type')).toBe(false);
  });
});

describe('canClickFor a control learning saw open something', () => {
  it('presses an Invite button that opens the invite form, but never a submit button', () => {
    expect(canClickFor(html('<button type="button">Invite</button>'))).toBe(false);
    expect(canClickFor(html('<button type="button">Invite</button>'), { opens: true })).toBe(true);
    expect(canClickFor(html('<form><button type="submit">Send invite</button></form>').querySelector('button')!, { opens: true })).toBe(false);
  });
});
