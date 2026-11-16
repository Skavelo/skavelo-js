// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { scanPage } from './dom-scanner';

// happy-dom has no layout; give every element a visible box.
beforeEach(() => {
  Element.prototype.getBoundingClientRect = () => ({ x: 10, y: 10, left: 10, top: 10, right: 210, bottom: 40, width: 200, height: 30, toJSON: () => ({}) }) as DOMRect;
});

describe('scanPage names controls as learning does', () => {
  const named = () => scanPage().filter((e) => e.interactive).map((e) => ({ role: e.role, name: e.name, text: e.text }));

  it('names a template card by its title, keeping its text', () => {
    document.body.innerHTML = `
      <button><h3>Post-Purchase Review Request</h3><p>Asks for a product review a week after the order is fulfilled.</p><span>E-COMMERCE</span></button>
      <button>Save</button>`;
    const [card, save] = named();
    expect(card.name).toBe('Post-Purchase Review Request');
    expect(card.text).toContain('Asks for a product review');
    expect(save.name).toBe('Save');
  });

  it('keeps two cards with the same title apart', () => {
    document.body.innerHTML = `
      <button><h3>Upgrade</h3><p>Starter plan, 2,000 conversations a month.</p></button>
      <button><h3>Upgrade</h3><p>Growth plan, 10,000 conversations a month.</p></button>`;
    const names = named().map((c) => c.name);
    expect(names[0]).not.toBe('Upgrade');
    expect(names[0]).not.toBe(names[1]);
  });

  it('names a dropdown by its label, and doesn’t pass off the chosen option as its name', () => {
    document.body.innerHTML = `<div><p>Font</p><button aria-haspopup="listbox">Inter</button></div>`;
    expect(named()).toEqual([{ role: 'button', name: 'Font', text: undefined }]);
  });

  it('names a field by the text before it, not its example placeholder', () => {
    document.body.innerHTML = `<div><label>Street address</label><input placeholder="123 Business Avenue"></div>`;
    expect(named()[0].name).toBe('Street address');
  });
});

describe('scanPage privacy', () => {
  it('never sends typed text, passwords or private areas', () => {
    document.body.innerHTML = `
      <button>Save invoice</button>
      <input placeholder="Customer email" value="ada@example.com" />
      <input type="password" value="hunter2" />
      <textarea placeholder="Notes">secret note</textarea>
      <div contenteditable="true">Draft reply with private details</div>
      <section data-sk-sensitive><p>Card ending 4242 for Ada</p></section>`;
    const json = JSON.stringify(scanPage());
    expect(json).toContain('Save invoice');
    expect(json).toContain('Customer email');
    for (const secret of ['ada@example.com', 'hunter2', 'secret note', 'Draft reply', '4242']) {
      expect(json).not.toContain(secret);
    }
  });
});
