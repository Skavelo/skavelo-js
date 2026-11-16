// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { resolveLocator } from './locator';

afterEach(() => {
  document.body.innerHTML = '';
});

function sized() {
  for (const el of Array.from(document.querySelectorAll('*'))) {
    (el as HTMLElement).getBoundingClientRect = () => ({ width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20 }) as DOMRect;
  }
}

// Peleka's Choose a Template dialog: each template is one button with a title, a description and a badge.
const picker = `
  <div role="dialog">
    <button id="cart"><div><h3>Abandoned Cart Recovery</h3></div><p>Three emails with the shopper's own cart: a reminder after 1 hour, a nudge after a day, and a unique 10% code 2 days later.</p><span>E-COMMERCE</span></button>
    <button id="review"><div><span>▣</span><h3>Post-Purchase Review Request</h3></div><p>Asks for a product review a week after the order is fulfilled, with one reminder.</p><span>E-COMMERCE</span></button>
    <button id="draft">Save draft</button>
  </div>`;

describe('cards found by their title', () => {
  it('finds a template card by its title, through the aria and text locators an answer step gets', () => {
    document.body.innerHTML = picker;
    sized();
    expect(resolveLocator([{ type: 'aria', score: 0.6, value: 'button::Post-Purchase Review Request' }]).el?.id).toBe('review');
    expect(resolveLocator([{ type: 'text', score: 0.55, value: 'Post-Purchase Review Request' }]).el?.id).toBe('review');
  });

  it('finds a required field learning names without its star', () => {
    document.body.innerHTML = `<label for="e">Email address *</label><input id="e">`;
    sized();
    expect(resolveLocator([{ type: 'aria', score: 0.8, value: 'textbox::Email address' }]).el?.id).toBe('e');
  });

  it('doesn’t match a short name by the start of a longer one', () => {
    document.body.innerHTML = picker;
    sized();
    expect(resolveLocator([{ type: 'aria', score: 0.6, value: 'button::Save' }]).el).toBeNull();
    expect(resolveLocator([{ type: 'text', score: 0.55, value: 'Save' }]).el).toBeNull();
  });

  it('finds neither of two cards with the same title, rather than guess', () => {
    document.body.innerHTML = `
      <button id="starter"><h3>Upgrade</h3><p>Starter plan, 2,000 conversations a month.</p></button>
      <button id="growth"><h3>Upgrade</h3><p>Growth plan, 10,000 conversations a month.</p></button>`;
    sized();
    expect(resolveLocator([{ type: 'aria', score: 0.6, value: 'button::Upgrade' }]).el).toBeNull();
    expect(resolveLocator([{ type: 'text', score: 0.55, value: 'Upgrade' }]).el).toBeNull();
  });

  it('leaves exact matches as they were: a button named exactly wins over a card titled the same', () => {
    document.body.innerHTML = `
      <button id="card"><h3>Export</h3><p>Download every contact as a CSV file.</p></button>
      <button id="plain">Export</button>`;
    sized();
    expect(resolveLocator([{ type: 'aria', score: 0.6, value: 'button::Export' }]).el?.id).toBe('plain');
    expect(resolveLocator([{ type: 'text', score: 0.55, value: 'Export' }]).el?.id).toBe('plain');
  });
});
