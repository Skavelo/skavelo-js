// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { clearRequests, collectPageSignals, recordRequest, tidyPath } from './signals';

afterEach(() => { document.body.innerHTML = ''; clearRequests(); });

describe('tidyPath', () => {
  it('replaces IDs, tokens and emails with :id', () => {
    expect(tidyPath('/broadcasts/8213/send')).toBe('/broadcasts/:id/send');
    expect(tidyPath('/users/3f2b1c9e-8a7d-4e6f-9b0a-1c2d3e4f5a6b')).toBe('/users/:id');
    expect(tidyPath('/invite/eyJhbGciOiJIUzI1NiJ9abcdefghijk')).toBe('/invite/:id');
    expect(tidyPath('/contacts/sam@example.com')).toBe('/contacts/:id');
    expect(tidyPath('/settings/domains')).toBe('/settings/domains');
  });
});

describe('collectPageSignals', () => {
  it('reads errors on screen and switched off buttons with their reason', () => {
    document.body.innerHTML = `
      <div role="alert">Your sending domain isn't verified</div>
      <span id="tip">Verify your domain first</span>
      <button disabled aria-describedby="tip">Send broadcast</button>
      <div data-sk-sensitive><div role="alert">Card 4242 declined</div></div>`;
    expect(collectPageSignals()).toEqual({
      errors: ["Your sending domain isn't verified"],
      disabled: [{ label: 'Send broadcast', reason: 'Verify your domain first' }],
    });
  });

  it('keeps failed requests from the last 2 minutes, without query strings', () => {
    const now = 1_000_000;
    recordRequest('post', '/api/broadcasts/12/send?token=abc', 402, now - 10_000);
    recordRequest('get', '/api/old', 500, now - 5 * 60_000);
    recordRequest('get', '/api/ok', 200, now);
    expect(collectPageSignals(now).failedRequests).toEqual([
      { method: 'POST', path: '/api/broadcasts/:id/send', status: 402, secondsAgo: 10 },
    ]);
  });

  it("ignores another site's requests that never completed, like a blocked tracker", () => {
    recordRequest('get', 'https://tracker.example.net/collect', 0);
    recordRequest('get', 'https://api.stripe.com/v1/charges', 402);
    expect(collectPageSignals().failedRequests).toEqual([
      expect.objectContaining({ host: 'api.stripe.com', path: '/v1/charges', status: 402 }),
    ]);
  });

  it('returns nothing when the page is fine', () => {
    document.body.innerHTML = '<button>Save</button>';
    expect(collectPageSignals()).toEqual({});
  });
});
