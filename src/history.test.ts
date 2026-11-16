// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SkavelInstance } from './skavelo';
import type { RemoteConfig, UserContext } from './types';

/** History end to end with a stubbed API: who gets it, resuming, and New chat. */

const API = 'https://api.test/api';
const SETTINGS: RemoteConfig = { id: 'a', name: 'Help', appearance: { cursor: false }, branding: false, stuckHelp: false };
const PAST = [{ id: '11111111-1111-4111-8111-111111111111', title: 'How do I cancel?', at: new Date().toISOString() }];

let requests: { path: string; body: Record<string, unknown> }[] = [];

function serve(available = true) {
  requests = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace(API, '');
    const body = init?.body ? JSON.parse(init.body as string) : {};
    requests.push({ path, body });
    let res: unknown = {};
    if (path === '/sdk/v1/history') res = { available, conversations: available ? PAST : [] };
    else if (path.startsWith('/sdk/v1/history/')) res = { id: PAST[0].id, messages: [
      { id: 'm1', sender: 'user', content: 'How do I cancel?', at: '' },
      { id: 'm2', sender: 'assistant', content: 'Open **Billing**.', at: '' },
    ] };
    else if (path === '/sdk/v1/ask') res = { conversationId: '22222222-2222-4222-8222-222222222222', messageId: 'm3', mode: 'answer', answer: { text: 'Sure.', sources: [] } };
    // No stream from the stub: the widget falls back to the plain ask.
    if (path === '/sdk/v1/ask/stream') return new Response('', { status: 404 });
    return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
}

let sk: SkavelInstance | null = null;
const start = (user?: UserContext) => {
  sk = new SkavelInstance({ agentId: 'a', apiUrl: API, diagnostics: { network: false }, user }, SETTINGS);
  return sk;
};
const root = () => (sk as unknown as { shadowHost: { getRoot(): ShadowRoot } }).shadowHost.getRoot();
const $ = (sel: string) => root().querySelector(sel) as HTMLElement;
const flush = () => new Promise((r) => setTimeout(r, 0));
const asks = () => requests.filter((r) => r.path.startsWith('/sdk/v1/ask') && r.path !== '/sdk/v1/ask/stream');

beforeEach(() => {
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

describe('history', () => {
  it('is never asked for without a signed identity', async () => {
    serve();
    start({ id: 'u1' }).open();
    await flush();
    expect(requests.some((r) => r.path === '/sdk/v1/history')).toBe(false);
    expect($('.sk-history-btn').hidden).toBe(true);
  });

  it('stays hidden when the server can’t verify the identity', async () => {
    serve(false);
    start({ id: 'u1', userHash: 'f'.repeat(64) }).open();
    await flush();
    expect(requests.some((r) => r.path === '/sdk/v1/history')).toBe(true);
    expect($('.sk-history-btn').hidden).toBe(true);
  });

  it('resumes a past conversation and carries it on with the next question, once', async () => {
    serve();
    const s = start({ id: 'u1', userHash: 'f'.repeat(64) });
    s.open();
    await flush();
    expect($('.sk-history-btn').hidden).toBe(false);
    ($('.sk-chip--resume') as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(root().querySelectorAll('.sk-msg').length).toBe(2);
    s.ask('And after that?');
    await vi.waitFor(() => expect(asks().length).toBe(1));
    expect(asks()[0].body.conversationId).toBe(PAST[0].id);
    expect(asks()[0].body.resumeFrom).toBe(PAST[0].id);
    await vi.waitFor(() => expect(root().querySelectorAll('.sk-msg').length).toBe(4));
    s.ask('Thanks');
    await vi.waitFor(() => expect(asks().length).toBe(2));
    expect(asks()[1].body.resumeFrom).toBeUndefined();
    expect(asks()[1].body.conversationId).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('shows the conversation under way again after a page load, without opening the widget', async () => {
    serve();
    localStorage.setItem('_sk_conversation_a', JSON.stringify({ agentId: 'a', id: PAST[0].id, userId: 'u1', at: Date.now() }));
    start({ id: 'u1', userHash: 'f'.repeat(64) });
    await vi.waitFor(() => expect(root().querySelectorAll('.sk-msg').length).toBe(2));
    expect(requests.some((r) => r.path === `/sdk/v1/history/${PAST[0].id}`)).toBe(true);
    expect($('.sk-panel').hidden).toBe(true);
    // Opening it shows the conversation, not an empty question bar.
    sk!.open();
    expect($('.sk-panel').hidden).toBe(false);
  });

  it('doesn’t fetch a conversation after a page load without a signed identity', async () => {
    serve();
    localStorage.setItem('_sk_conversation_a', JSON.stringify({ agentId: 'a', id: PAST[0].id, userId: 'u1', at: Date.now() }));
    start({ id: 'u1' });
    await flush();
    await flush();
    expect(requests.some((r) => r.path.startsWith('/sdk/v1/history/'))).toBe(false);
    expect(root().querySelectorAll('.sk-msg').length).toBe(0);
  });

  it('starts fresh after New chat', async () => {
    serve();
    const s = start({ id: 'u1', userHash: 'f'.repeat(64) });
    s.ask('First question');
    await vi.waitFor(() => expect(asks().length).toBe(1));
    await vi.waitFor(() => expect(root().querySelectorAll('.sk-msg').length).toBe(2));
    ($('.sk-new-btn') as HTMLButtonElement).click();
    expect(root().querySelectorAll('.sk-msg').length).toBe(0);
    s.ask('Second question');
    await vi.waitFor(() => expect(asks().length).toBe(2));
    expect(asks()[1].body.conversationId).toBeUndefined();
  });
});
