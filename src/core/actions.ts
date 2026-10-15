import type { ActionsCfg, DoPayload, LookPayload } from '../types';

export interface ActionResult {
  ok: boolean;
  /** Shown to the visitor under the action. */
  message: string;
  /** Recorded for the dashboard: HTTP status or what went wrong. */
  detail: string;
}

/**
 * Sends an approved action to the customer's own API, from the page the visitor is on, with their
 * session cookies. The server only ever proposes a same-site path, and this checks it again.
 */
export async function runAction(action: DoPayload, cfg: ActionsCfg | undefined, fetchImpl: typeof fetch = fetch): Promise<ActionResult> {
  const { method, path, body } = action.request;
  if (!/^\/(?![\/\\])/.test(path)) {
    return { ok: false, message: "This action isn't configured correctly, so it wasn't run.", detail: 'unsafe path' };
  }
  const base = (cfg?.baseUrl ?? window.location.origin).replace(/\/$/, '');
  let headers: Record<string, string> = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  try {
    if (cfg?.headers) headers = { ...headers, ...(await cfg.headers()) };
  } catch {
    // Headers are often a CSRF token; without it the call would only fail, so say so.
    return { ok: false, message: "This action couldn't be prepared. Please refresh the page and try again.", detail: 'headers() threw' };
  }

  try {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return { ok: true, message: 'Done.', detail: String(res.status) };
    const message = res.status === 401 || res.status === 403
      ? "You don't have permission for this action, or your session has expired. Please sign in again and try again."
      : res.status === 404
        ? "The item couldn't be found, so no changes were made."
        : res.status >= 500
          ? 'The app ran into a problem and the action wasn\'t confirmed. Please check whether anything changed before trying again.'
          : "The action didn't go through. Please check the details and try again.";
    return { ok: false, message, detail: String(res.status) };
  } catch {
    return { ok: false, message: "We couldn't reach the app to run this action. Please check your connection and try again.", detail: 'network error' };
  }
}

/** How much of a lookup's response goes back to Skavelo. */
export const LOOKUP_MAX_CHARS = 12_000;
const LOOKUP_TIMEOUT_MS = 6_000;

/**
 * Reads the visitor's own data for a lookup: a GET to the customer's API from this page, with the
 * visitor's session, so it only ever sees what they can. JSON is compacted and everything is cut
 * to LOOKUP_MAX_CHARS. Status 0 means the app couldn't be reached.
 */
export async function runLookup(
  look: LookPayload,
  cfg: ActionsCfg | undefined,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; body: string }> {
  const { path } = look.request;
  if (look.request.method !== 'GET' || !/^\/(?![\/\\])/.test(path)) return { status: 0, body: 'Not run: the lookup is not a GET on this site.' };
  const base = (cfg?.baseUrl ?? window.location.origin).replace(/\/$/, '');
  let headers: Record<string, string> = { Accept: 'application/json' };
  try {
    if (cfg?.headers) headers = { ...headers, ...(await cfg.headers()) };
  } catch {
    return { status: 0, body: 'Not run: the page could not prepare the request headers.' };
  }
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), LOOKUP_TIMEOUT_MS);
  const stop = () => timeout.abort();
  signal?.addEventListener('abort', stop);
  try {
    const res = await fetchImpl(`${base}${path}`, { method: 'GET', headers, credentials: 'include', signal: timeout.signal });
    let body = await res.text();
    try {
      body = JSON.stringify(JSON.parse(body));
    } catch {
      // Not JSON: sent as it came.
    }
    return { status: res.status, body: body.slice(0, LOOKUP_MAX_CHARS) };
  } catch {
    return { status: 0, body: signal?.aborted ? 'Stopped.' : 'The app could not be reached, or took too long.' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}
