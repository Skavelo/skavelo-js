// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { alreadyHere, onPage, ShowMode } from './show';
import type { SessionStore } from '../core/session';
import type { ShowStep } from '../types';

// happy-dom has no layout; give every element a visible box.
beforeEach(() => {
  Element.prototype.getBoundingClientRect = () => ({ x: 10, y: 10, left: 10, top: 10, right: 210, bottom: 40, width: 200, height: 30, toJSON: () => ({}) }) as DOMRect;
  document.body.innerHTML = `<nav><a href="/">Home</a><a href="/automations/">Automations</a></nav><button aria-label="Journey actions">⋯</button>`;
});

const step = (role: string, name: string): ShowStep => ({
  id: name, order: 0, instruction: `Click **${name}**.`, pageUrlPattern: '/', locators: [{ type: 'aria', value: `${role}::${name}`, score: 0.8 }],
});
const pause = [step('link', 'Automations'), step('button', 'Journey actions'), step('menuitem', 'Pause journey')];

describe('alreadyHere', () => {
  it('skips the step that only leads to the page the user is on', () => {
    history.replaceState(null, '', '/automations');
    expect(alreadyHere(pause)).toBe(1);
  });

  it('keeps it when the user is somewhere else', () => {
    history.replaceState(null, '', '/broadcasts');
    expect(alreadyHere(pause)).toBe(0);
  });

  it('never skips the last step', () => {
    history.replaceState(null, '', '/automations');
    expect(alreadyHere([step('link', 'Automations')])).toBe(0);
  });
});

describe('onPage', () => {
  it('matches the path, with :id standing for one segment', () => {
    expect(onPage('/automation', '/automation/')).toBe(true);
    expect(onPage('/automation/:id', '/automation/42')).toBe(true);
    expect(onPage('/automation', '/audience')).toBe(false);
    expect(onPage('/automation/:id', '/automation/42/edit')).toBe(false);
    expect(onPage('/', '/')).toBe(true);
  });
});

describe('ShowMode.resolve', () => {
  const session = { setWalkthrough: () => {} } as unknown as SessionStore;
  const onAutomations = (s: ShowStep): ShowStep => ({ ...s, pageUrlPattern: '/automations' });

  it("doesn't highlight a look-alike button on another page; it points the way there instead", () => {
    history.replaceState(null, '', '/audience');
    const view = new ShowMode({ workflowId: 'w', steps: [onAutomations(step('button', 'Journey actions'))] }, session, () => {}).resolve();
    expect(view?.el?.getAttribute('aria-label')).not.toBe('Journey actions');
    expect(view?.bridge).toBe(true);
    expect(view?.el?.getAttribute('href')).toMatch(/^\/automations/);
    expect(view?.instruction).toBe('Open **Automations** first.');
  });

  it('highlights it on its own page', () => {
    history.replaceState(null, '', '/automations');
    const view = new ShowMode({ workflowId: 'w', steps: [onAutomations(step('button', 'Journey actions'))] }, session, () => {}).resolve();
    expect(view?.el?.getAttribute('aria-label')).toBe('Journey actions');
  });

  it('still highlights navigation from any page', () => {
    history.replaceState(null, '', '/audience');
    const view = new ShowMode({ workflowId: 'w', steps: [onAutomations(step('link', 'Automations'))] }, session, () => {}).resolve();
    expect(view?.el?.textContent).toBe('Automations');
  });
});

describe('ShowMode.resolve: a control behind an earlier step', () => {
  const session = { setWalkthrough: () => {} } as unknown as SessionStore;
  // Step 2 opens a window; step 3's field is inside it. The window isn't open.
  const domain: ShowStep[] = [
    { ...step('button', 'Journey actions'), pageUrlPattern: '/settings' },
    { id: 'add', order: 1, instruction: 'Click **Add Domain**.', pageUrlPattern: '/settings', locators: [{ type: 'testid', value: 'add-domain', score: 0.9 }] },
    { id: 'field', order: 2, title: 'Enter your domain', instruction: 'Enter your domain in the **Domain** field.', pageUrlPattern: '/settings', locators: [{ type: 'testid', value: 'domain-field', score: 0.9 }] },
  ];
  beforeEach(() => {
    history.replaceState(null, '', '/settings');
    document.body.insertAdjacentHTML('beforeend', '<button data-testid="add-domain">Add Domain</button>');
  });

  it('points at the nearest earlier control that leads there, once the step has had a moment', () => {
    vi.useFakeTimers();
    try {
      const mode = new ShowMode({ workflowId: 'w', steps: domain }, session, () => {}, { startAt: 2 });
      // Straight after reaching the step the window may still be opening: no pointing back yet.
      expect(mode.resolve()?.el).toBeNull();
      expect(mode.msUntilLead()).toBeGreaterThan(0);
      vi.advanceTimersByTime(1100);
      const view = mode.resolve();
      expect(view?.el?.getAttribute('data-testid')).toBe('add-domain');
      expect(view?.lead).toBe(true);
      expect(view?.bridge).toBe(true);
      expect(view?.stepIndex).toBe(2);
      expect(view?.heading).toBe('Enter your domain');
      expect(view?.instruction).toBe('First, click **Add Domain**.');
      expect(view?.details).toBe('Then enter your domain in the **Domain** field.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('moves to the control itself once it appears', () => {
    vi.useFakeTimers();
    try {
      const mode = new ShowMode({ workflowId: 'w', steps: domain }, session, () => {}, { startAt: 2 });
      vi.advanceTimersByTime(1100);
      document.body.insertAdjacentHTML('beforeend', '<input data-testid="domain-field">');
      const view = mode.resolve();
      expect(view?.el?.getAttribute('data-testid')).toBe('domain-field');
      expect(view?.lead).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows nothing to point at when no earlier control is on screen either', () => {
    vi.useFakeTimers();
    try {
      document.querySelector('[data-testid="add-domain"]')?.remove();
      const mode = new ShowMode({ workflowId: 'w', steps: domain.slice(1) }, session, () => {}, { startAt: 1 });
      vi.advanceTimersByTime(1100);
      expect(mode.resolve()?.el).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
