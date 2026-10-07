import { describe, expect, it, vi } from 'vitest';
import { runAction } from './actions';
import type { DoPayload } from '../types';

const action = (request: DoPayload['request']): DoPayload => ({
  skillId: 's1', skillName: 'Send invoice reminder', summary: 'Send it', inputs: {}, request,
});

const reply = (status: number) => Promise.resolve(new Response(null, { status }));

describe('runAction', () => {
  it('sends the request with cookies and the extra headers', async () => {
    const fetchImpl = vi.fn(() => reply(200));
    const result = await runAction(
      action({ method: 'POST', path: '/api/invoices/INV-1/remind', body: { tone: 'friendly' } }),
      { baseUrl: 'https://app.example.com/', headers: () => ({ 'X-CSRF-Token': 'abc' }) },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toEqual({ ok: true, message: 'Done.', detail: '200' });
    expect(fetchImpl).toHaveBeenCalledWith('https://app.example.com/api/invoices/INV-1/remind', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': 'abc' },
      credentials: 'include',
      body: '{"tone":"friendly"}',
    });
  });

  it('refuses a path that leaves the site', async () => {
    const fetchImpl = vi.fn(() => reply(200));
    const result = await runAction(action({ method: 'GET', path: '//evil.example/x' }), { baseUrl: 'https://a.com' }, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('explains permission errors', async () => {
    const result = await runAction(action({ method: 'DELETE', path: '/api/x' }), { baseUrl: 'https://a.com' }, (() => reply(403)) as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: false, detail: '403' });
    expect(result.message).toMatch(/permission/);
  });

  it('reports network failures', async () => {
    const result = await runAction(action({ method: 'GET', path: '/api/x' }), { baseUrl: 'https://a.com' }, (() => Promise.reject(new TypeError('fail'))) as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: false, detail: 'network error' });
  });
});
