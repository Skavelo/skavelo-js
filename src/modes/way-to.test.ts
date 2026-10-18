// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { wayTo } from './show';

/** happy-dom has no layout, so every element measures 0 by 0: give links a size. */
function link(href: string, html: string) {
  const a = document.createElement('a');
  a.href = href;
  a.innerHTML = html;
  a.getBoundingClientRect = () => ({ width: 20, height: 20 }) as DOMRect;
  document.body.appendChild(a);
  return a;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('wayTo', () => {
  it('finds the icon link to the step’s page, by its hidden label', () => {
    link('/broadcasts', 'Broadcasts');
    const gear = link('/settings', '<svg></svg><span class="sr-only">Settings</span>');
    expect(wayTo('/settings')).toEqual({ el: gear, label: 'Settings' });
  });

  it('falls back to the closest page above, and prefers an exact link', () => {
    const settings = link('/settings', 'Settings');
    expect(wayTo('/settings/compliance')?.el).toBe(settings);
    const compliance = link('/settings/compliance', 'Compliance');
    expect(wayTo('/settings/compliance')?.el).toBe(compliance);
  });

  it('ignores the home link, other sites, hidden and unlabelled links', () => {
    link('/', 'Home');
    link('https://elsewhere.example/settings', 'Settings');
    const hidden = link('/settings', 'Settings');
    hidden.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;
    link('/settings', '');
    expect(wayTo('/settings/compliance')).toBeNull();
  });
});
