// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
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

  it("doesn't highlight a look-alike button on another page", () => {
    history.replaceState(null, '', '/audience');
    const view = new ShowMode({ workflowId: 'w', steps: [onAutomations(step('button', 'Journey actions'))] }, session, () => {}).resolve();
    expect(view?.el).toBeNull();
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
