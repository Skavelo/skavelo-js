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
const find = (value: string, type: 'aria' | 'text' = 'aria') => resolveLocator([{ type, score: 0.8, value }]).el;

describe('dropdowns, by the names learning gives them', () => {
  it('finds a font picker by the text before it, whatever font it shows', () => {
    document.body.innerHTML = `<div><p>Font</p><button id="font" aria-haspopup="listbox">Inter</button></div>`;
    sized();
    expect(find('button::Font')?.id).toBe('font');
    // Another font picked since learning: still found.
    document.getElementById('font')!.textContent = 'Roboto';
    expect(find('button::Font')?.id).toBe('font');
  });

  it('still finds it by the old name an earlier map recorded, until the agent re-learns', () => {
    document.body.innerHTML = `<div><p>Font</p><button id="font" aria-haspopup="listbox">Inter</button></div>`;
    sized();
    expect(resolveLocator([
      { type: 'aria', score: 0.8, value: 'button::Inter' },
      { type: 'text', score: 0.6, value: 'Inter' },
    ]).el?.id).toBe('font');
  });

  it('finds a native select by its label', () => {
    document.body.innerHTML = `<label for="tz">Time zone</label><select id="tz"><option>London</option><option>Lagos</option></select>`;
    sized();
    expect(find('combobox::Time zone')?.id).toBe('tz');
  });
});

describe('fields named by their placeholder', () => {
  it('finds a field without the placeholder’s trailing dots, and by the old name with them', () => {
    document.body.innerHTML = `<section><div><input id="j" placeholder="Name your journey..."><input placeholder="Search"></div></section>`;
    sized();
    expect(find('textbox::Name your journey')?.id).toBe('j');
    expect(find('textbox::Name your journey...')?.id).toBe('j');
  });

  it('finds a field whose placeholder is an example by its name attribute', () => {
    document.body.innerHTML = `<section><div><input id="c" placeholder="e.g. Acme" name="company_name"><input id="w" placeholder="https://" name="website"></div></section>`;
    sized();
    expect(find('textbox::Company name')?.id).toBe('c');
    expect(find('textbox::Website')?.id).toBe('w');
  });
});
