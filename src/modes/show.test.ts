// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { alreadyHere, forScreen, locatorsOf, onPage, ShowMode } from './show';
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

describe('ShowMode.resolve on a phone', () => {
  const session = { setWalkthrough: () => {} } as unknown as SessionStore;
  const billing: ShowStep = { ...step('link', 'Billing'), pageUrlPattern: '/billing' };
  const phone = (on: boolean) => {
    window.matchMedia = ((q: string) => ({ matches: on, media: q })) as unknown as typeof window.matchMedia;
  };
  // Started long enough ago that a missing control isn't still on its way in.
  const settled = (steps: ShowStep[]) => {
    const mode = new ShowMode({ workflowId: 'w', steps }, session, () => {});
    vi.spyOn(mode, 'msUntilLead').mockReturnValue(0);
    return mode;
  };

  beforeEach(() => {
    history.replaceState(null, '', '/');
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const size = this.closest('[hidden]') ? 0 : 30;
      return { x: 0, y: 0, left: 0, top: 0, right: size, bottom: size, width: size, height: size, toJSON: () => ({}) } as DOMRect;
    };
  });

  it('points at the menu button when the link is hidden in the sidebar', () => {
    phone(true);
    document.body.innerHTML = `<button aria-controls="side" aria-label="Open menu">☰</button><nav id="side" hidden><a href="/billing">Billing</a></nav>`;
    const view = settled([billing]).resolve();
    expect(view?.el?.getAttribute('aria-label')).toBe('Open menu');
    expect(view?.instruction).toBe('Open the menu first.');
    expect(view?.details).toBe('Then tap **Billing**.');
    expect(view?.bridge).toBe(true);
  });

  it("points at the menu button when the menu's links aren't on the page yet, and only until it's opened", () => {
    phone(true);
    document.body.innerHTML = `<header><button class="menu-toggle"></button></header><main></main>`;
    const mode = settled([billing]);
    const view = mode.resolve();
    expect(view?.el?.className).toBe('menu-toggle');
    (view!.el as HTMLElement).click();
    expect(mode.resolve()?.el).toBeNull();
  });

  it('finds a link by where it goes when its label is different here', () => {
    phone(true);
    document.body.innerHTML = `<nav><a href="/settings/billing" aria-label="Payments">💳</a></nav>`;
    const step: ShowStep = {
      ...billing,
      pageUrlPattern: '/settings/billing',
      locators: [
        { type: 'aria', value: 'link::Billing', score: 0.8 },
        { type: 'attr', value: 'href=/settings/billing', score: 0.7 },
      ],
    };
    expect(settled([step]).resolve()?.el?.getAttribute('aria-label')).toBe('Payments');
  });

  it("doesn't guess at a menu on a computer", () => {
    phone(false);
    document.body.innerHTML = `<header><button class="menu-toggle"></button></header><main></main>`;
    expect(settled([billing]).resolve()?.el).toBeNull();
  });
});

describe('forScreen', () => {
  it('drops the sidebar and top bar and says tap on a phone', () => {
    expect(forScreen('Click **Billing** in the sidebar.', true)).toBe('Tap **Billing**.');
    expect(forScreen('Click **Profile** in the top bar, then click **Sign out**.', true)).toBe('Tap **Profile**, then tap **Sign out**.');
    expect(forScreen('Keep clicking **Next**.', true)).toBe('Keep tapping **Next**.');
  });

  it('leaves the words alone on a computer', () => {
    expect(forScreen('Click **Billing** in the sidebar.', false)).toBe('Click **Billing** in the sidebar.');
  });
});


describe('a walkthrough the team wrote', () => {
  const session = { setWalkthrough: () => {} } as unknown as SessionStore;
  // Steps written by hand: no locators, only the instruction and the page.
  const signup: ShowStep[] = [
    { id: 'a', order: 1, instruction: 'Click **Create an account**.', pageUrlPattern: '/login', locators: [] },
    { id: 'b', order: 2, instruction: 'Enter your email address in the **Work email** field.', pageUrlPattern: '/signup', locators: [] },
    { id: 'c', order: 3, instruction: 'Click **Continue**.', pageUrlPattern: '/signup', locators: [] },
  ];

  beforeEach(() => {
    Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 30, width: 200, height: 30, toJSON: () => ({}) }) as DOMRect;
    document.body.innerHTML = `<a href="/login">Sign in</a><label for="email">Work email</label><input id="email" type="email"><button>Continue</button>`;
  });

  it('starts on this page when the first step only leads here from another', () => {
    history.replaceState(null, '', '/signup');
    expect(alreadyHere(signup)).toBe(1);
    history.replaceState(null, '', '/login');
    expect(alreadyHere(signup)).toBe(0);
  });

  it('finds the field and button by the names in bold', () => {
    history.replaceState(null, '', '/signup');
    const mode = new ShowMode({ workflowId: 'w', steps: signup }, session, () => {});
    expect(mode.resolve()?.el?.id).toBe('email');
    mode.advance();
    expect(mode.resolve()?.el?.textContent).toBe('Continue');
  });

  it('only guesses from the instruction when the step has no locators', () => {
    expect(locatorsOf({ ...signup[1], locators: [{ type: 'testid', value: 'x', score: 0.9 }] })).toEqual([{ type: 'testid', value: 'x', score: 0.9 }]);
    expect(locatorsOf(signup[1])[0]).toEqual({ type: 'aria', value: 'textbox::Work email', score: 0.6 });
  });
});
