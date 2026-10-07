// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { scanPage } from './dom-scanner';

// happy-dom has no layout; give every element a visible box.
beforeEach(() => {
  Element.prototype.getBoundingClientRect = () => ({ x: 10, y: 10, left: 10, top: 10, right: 210, bottom: 40, width: 200, height: 30, toJSON: () => ({}) }) as DOMRect;
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
