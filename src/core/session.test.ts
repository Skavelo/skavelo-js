// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONVERSATION_IDLE_MS, SessionStore } from './session';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useRealTimers();
});

describe('SessionStore', () => {
  it('shares the conversation with other tabs of the same site', () => {
    new SessionStore('a').setConversationId('c1');
    sessionStorage.clear(); // a new tab starts with an empty sessionStorage
    expect(new SessionStore('a').getConversationId()).toBe('c1');
  });

  it('keeps each agent to its own conversation, on a site with several', () => {
    new SessionStore('a').setConversationId('c1');
    expect(new SessionStore('b').getConversationId()).toBeUndefined();
    new SessionStore('b').setConversationId('c2');
    expect(new SessionStore('a').getConversationId()).toBe('c1');
  });

  it('drops a conversation idle longer than the server allows', () => {
    vi.useFakeTimers();
    new SessionStore('a').setConversationId('c1');
    vi.advanceTimersByTime(CONVERSATION_IDLE_MS + 1);
    expect(new SessionStore('a').getConversationId()).toBeUndefined();
    expect(localStorage.length).toBe(0);
  });

  it("never hands one user's conversation to another, or to a signed-out visitor", () => {
    new SessionStore('a', () => 'u1').setConversationId('c1');
    expect(new SessionStore('a', () => 'u2').getConversationId()).toBeUndefined();
    new SessionStore('a', () => 'u1').setConversationId('c2');
    expect(new SessionStore('a').getConversationId()).toBeUndefined();
  });

  it('lets a visitor who signs in carry on their anonymous conversation', () => {
    new SessionStore('a').setConversationId('c1');
    expect(new SessionStore('a', () => 'u1').getConversationId()).toBe('c1');
  });

  it('keeps a walkthrough to the tab it started in', () => {
    const payload = { steps: [] } as never;
    new SessionStore('a').setWalkthrough({ payload, stepIndex: 2 });
    expect(new SessionStore('a').getWalkthrough()?.stepIndex).toBe(2);
    expect(localStorage.getItem('_sk_session')).toBeNull();
    sessionStorage.clear();
    expect(new SessionStore('a').getWalkthrough()).toBeNull();
  });
});
