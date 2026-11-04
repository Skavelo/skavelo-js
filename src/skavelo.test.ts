// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SkavelInstance } from './skavelo';
import type { RemoteConfig, ShowPayload, ShowStep } from './types';

/**
 * The widget class end to end, in a small single page app: settings come prefetched, a saved
 * walkthrough comes from a stubbed API, and the page reacts to clicks the way a real app does,
 * a moment late. Covers what only shows up with everything wired together, like a press landing
 * on the old page before the new one arrives.
 */

const API = 'https://api.test/api';
const SETTINGS: RemoteConfig = { id: 'a', name: 'Help', appearance: { cursor: false }, branding: false, stuckHelp: false };

const step = (role: string, name: string, page: string, extra: Partial<ShowStep> = {}): ShowStep => ({
  id: name, order: 0, instruction: `Click **${name}**.`, pageUrlPattern: page, locators: [{ type: 'aria', value: `${role}::${name}`, score: 0.8 }], ...extra,
});

/** Team opens its page late, like an app loading the page's code; Invite opens a dialog. */
function mountApp(navDelay = 700) {
  const clicks: Record<string, number> = {};
  const count = (id: string) => { clicks[id] = (clicks[id] ?? 0) + 1; };
  history.replaceState(null, '', '/');
  document.body.innerHTML = `<nav><a href="/team" id="team">Team</a></nav><main id="main"><h1>Home</h1></main>`;
  document.getElementById('team')!.addEventListener('click', (e) => {
    e.preventDefault();
    count('team');
    setTimeout(() => {
      history.pushState(null, '', '/team');
      document.getElementById('main')!.innerHTML = `<h1>Team</h1><button id="invite" type="button" aria-haspopup="dialog">Invite teammate</button>`;
      document.getElementById('invite')!.addEventListener('click', () => {
        count('invite');
        document.body.insertAdjacentHTML('beforeend', `<div role="dialog" aria-label="Invite"><label for="email">Email</label><input id="email" type="email"><button id="send" type="button">Send invite</button></div>`);
        document.getElementById('send')!.addEventListener('click', () => count('send'));
      });
    }, navDelay);
  });
  return clicks;
}

function serve(payload: ShowPayload) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url.replace(API, '')}`);
    const body = url.includes('/walkthroughs/') ? payload : {};
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  return calls;
}

let sk: SkavelInstance | null = null;
const start = () => {
  sk = new SkavelInstance({ agentId: 'a', apiUrl: API, diagnostics: { network: false } }, SETTINGS);
  return sk;
};

beforeEach(() => {
  // happy-dom has no layout; give every element a visible box.
  Element.prototype.getBoundingClientRect = () => ({ x: 10, y: 10, left: 10, top: 10, right: 210, bottom: 40, width: 200, height: 30, toJSON: () => ({}) }) as DOMRect;
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  sk?.destroy();
  sk = null;
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('Do it for me', () => {
  const invite: ShowPayload = {
    workflowId: 'w-invite',
    fill: true,
    steps: [
      step('link', 'Team', '/'),
      // No learned "opens" mark, as on agents learned before those existed: the button says it itself.
      step('button', 'Invite teammate', '/team'),
      step('textbox', 'Email', '/team', { instruction: 'Enter their email.', value: 'sam@example.com' }),
      step('button', 'Send invite', '/team'),
    ],
  };

  it('opens the page, the dialog and fills the email, pressing each control once, and leaves Send to the visitor', async () => {
    const clicks = mountApp();
    serve(invite);
    start().startWorkflow('w-invite', { intro: false });

    await vi.waitFor(() => expect((document.getElementById('email') as HTMLInputElement | null)?.value).toBe('sam@example.com'), { timeout: 8000, interval: 50 });
    // Long enough for a stray second press or a press on Send to have happened.
    await new Promise((r) => setTimeout(r, 1500));
    // The page was slow to arrive after Team, so Team was still showing when the walkthrough moved
    // on; it wasn't pressed again for the next step.
    expect(clicks).toEqual({ team: 1, invite: 1 });
  }, 15000);

  it('presses nothing more once the widget is removed partway (React unmounting it, say)', async () => {
    const clicks = mountApp(100);
    serve(invite);
    const events: string[] = [];
    start().on('walkthrough_start', () => events.push('start'));
    sk!.startWorkflow('w-invite', { intro: false });
    await vi.waitFor(() => expect(events).toEqual(['start']));
    await vi.waitFor(() => expect(clicks.team).toBe(1), { timeout: 4000, interval: 50 });
    sk!.destroy();
    sk = null;
    await new Promise((r) => setTimeout(r, 1500));
    expect(clicks.invite).toBeUndefined();
  }, 10000);
});

describe('guided walkthrough', () => {
  it('waits for the visitor: nothing is pressed for them, and their click moves it on', async () => {
    const clicks = mountApp(50);
    serve({ workflowId: 'w-guided', steps: [step('link', 'Team', '/'), step('button', 'Invite teammate', '/team'), step('button', 'Send invite', '/team')] });
    const done: string[] = [];
    start().on('walkthrough_start', (e) => done.push(e.workflowId));
    sk!.startWorkflow('w-guided', { intro: false });
    await vi.waitFor(() => expect(done).toEqual(['w-guided']));
    await new Promise((r) => setTimeout(r, 1200));
    expect(clicks).toEqual({});

    document.getElementById('team')!.click();
    await vi.waitFor(() => expect(document.getElementById('invite')).not.toBeNull(), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 1200));
    expect(clicks).toEqual({ team: 1 });
  }, 10000);
});

describe('settings', () => {
  it("stays out of sight when the agent doesn't exist", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"Unknown agent"}', { status: 401 })));
    sk = new SkavelInstance({ agentId: 'gone', apiUrl: API, diagnostics: { network: false } });
    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining('No agent with ID gone')));
    warn.mockRestore();
  });
});
