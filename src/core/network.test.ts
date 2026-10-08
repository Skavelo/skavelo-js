import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetworkClient, Refused, StreamUnavailable } from './network';

const payload = { question: 'hi', pageUrl: 'https://app.example.com/', elements: [] };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('NetworkClient refusals', () => {
  it('turns a 429 on the stream into Refused, with the reason for the developer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(429, { statusCode: 429, message: 'This agent reached its daily limit of 50 answers.' })));
    const err = await new NetworkClient('https://api.test/api', 'a').askStream(payload, { onText: () => {} }).catch((e) => e);
    expect(err).toBeInstanceOf(Refused);
    expect(err.message).toMatch(/daily limit/);
  });

  it('turns a limit reported inside the stream into Refused', async () => {
    const body = 'event: error\ndata: {"status":429,"message":"Monthly limit reached"}\n\n';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })));
    const err = await new NetworkClient('https://api.test/api', 'a').askStream(payload, { onText: () => {} }).catch((e) => e);
    expect(err).toBeInstanceOf(Refused);
    expect(err.status).toBe(429);
  });

  it('still falls back to the normal request when streaming is broken', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 502 })));
    const err = await new NetworkClient('https://api.test/api', 'a').askStream(payload, { onText: () => {} }).catch((e) => e);
    expect(err).toBeInstanceOf(StreamUnavailable);
  });

  it('refuses config from a site that is not allowed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(403, { message: "https://evil.test isn't one of this agent's allowed sites." })));
    const err = await new NetworkClient('https://api.test/api', 'a').config().catch((e) => e);
    expect(err).toBeInstanceOf(Refused);
    expect(err.status).toBe(403);
  });
});

describe('NetworkClient routes', () => {
  // Published widgets call these paths for as long as customers run them, so they must not drift.
  it('calls the versioned SDK routes', async () => {
    const fetchMock = vi.fn(async () => json(200, {}));
    vi.stubGlobal('fetch', fetchMock);
    const net = new NetworkClient('https://api.test/api/', 'a');
    await net.config();
    await net.ask(payload).catch(() => {});
    expect(fetchMock.mock.calls.map((c) => String((c as unknown[])[0]))).toEqual([
      'https://api.test/api/sdk/v1/config',
      'https://api.test/api/sdk/v1/ask',
    ]);
  });
});
