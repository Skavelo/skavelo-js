import { describe, expect, it, vi } from 'vitest';
import { LOOKUP_MAX_CHARS, runAction, runLookup } from './actions';
import type { DoPayload, LookPayload } from '../types';

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

describe('runLookup', () => {
  const look = (path: string, method = 'GET') => ({ skillId: 'l1', skillName: 'List invoices', request: { method, path } }) as LookPayload;

  it('reads with the session and headers, and compacts JSON', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('{\n  "invoices": [ { "id": "INV-1" } ]\n}', { status: 200 })));
    const result = await runLookup(look('/api/invoices?status=overdue'), { baseUrl: 'https://api.example.com', headers: () => ({ Authorization: 'Bearer t' }) }, undefined, fetchImpl as unknown as typeof fetch);
    expect(result).toEqual({ status: 200, body: '{"invoices":[{"id":"INV-1"}]}' });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.example.com/api/invoices?status=overdue', expect.objectContaining({
      method: 'GET', credentials: 'include', headers: { Accept: 'application/json', Authorization: 'Bearer t' },
    }));
  });

  it('cuts long responses', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('x'.repeat(LOOKUP_MAX_CHARS + 500), { status: 200 })));
    const result = await runLookup(look('/api/big'), { baseUrl: 'https://a.com' }, undefined, fetchImpl as unknown as typeof fetch);
    expect(result.body).toHaveLength(LOOKUP_MAX_CHARS);
  });

  it('passes on a refusal so Skavelo can explain it', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('{"message":"Unauthorized"}', { status: 401 })));
    expect((await runLookup(look('/api/me'), { baseUrl: 'https://a.com' }, undefined, fetchImpl as unknown as typeof fetch)).status).toBe(401);
  });

  it('never sends anything but a GET on the same site', async () => {
    const fetchImpl = vi.fn();
    expect((await runLookup(look('/api/x', 'POST'), undefined, undefined, fetchImpl as unknown as typeof fetch)).status).toBe(0);
    expect((await runLookup(look('//evil.example/x'), undefined, undefined, fetchImpl as unknown as typeof fetch)).status).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports an unreachable app as status 0', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await runLookup(look('/api/x'), { baseUrl: 'https://a.com' }, undefined, fetchImpl as unknown as typeof fetch)).toEqual({ status: 0, body: 'The app could not be reached, or took too long.' });
  });
});
