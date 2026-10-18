// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { resolveLocator } from './locator';

afterEach(() => {
  document.body.innerHTML = '';
});

/** happy-dom has no layout; give everything a size so it counts as visible. */
function sized() {
  for (const el of Array.from(document.querySelectorAll('*'))) {
    (el as HTMLElement).getBoundingClientRect = () => ({ width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20 }) as DOMRect;
  }
}

describe('fields whose label isn’t tied to them', () => {
  it('finds them by the label just before them, as learning names them (Peleka’s compliance form)', () => {
    document.body.innerHTML = `
      <div class="space-y-3">
        <div><label>Street address</label><input placeholder="123 Business Avenue"></div>
        <div class="grid">
          <div><label>City</label><input></div>
          <div><label>State / Province</label><input></div>
        </div>
      </div>`;
    sized();
    const street = resolveLocator([{ type: 'aria', score: 0.8, value: 'textbox::Street address' }]);
    expect((street.el as HTMLInputElement | null)?.placeholder).toBe('123 Business Avenue');
    const city = resolveLocator([{ type: 'aria', score: 0.8, value: 'textbox::City' }]);
    expect(city.el?.previousElementSibling?.textContent).toBe('City');
  });

  it('still prefers a real label, and doesn’t take a section heading for a field’s name', () => {
    document.body.innerHTML = `
      <label for="e">Email</label><input id="e">
      <section><h3>Address</h3><div><input placeholder="Line 1"><input placeholder="Line 2"></div></section>`;
    sized();
    expect(resolveLocator([{ type: 'aria', score: 0.8, value: 'textbox::Email' }]).el?.id).toBe('e');
    expect(resolveLocator([{ type: 'aria', score: 0.8, value: 'textbox::Address' }]).el).toBeNull();
    expect((resolveLocator([{ type: 'aria', score: 0.8, value: 'textbox::Line 2' }]).el as HTMLInputElement | null)?.placeholder).toBe('Line 2');
  });
});
