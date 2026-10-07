import type { ActionsCfg, DoPayload } from '../types';

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
    return { ok: false, message: "That action isn't set up correctly, so it didn't run.", detail: 'unsafe path' };
  }
  const base = (cfg?.baseUrl ?? window.location.origin).replace(/\/$/, '');
  let headers: Record<string, string> = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  try {
    if (cfg?.headers) headers = { ...headers, ...(await cfg.headers()) };
  } catch {
    // Headers are often a CSRF token; without it the call would only fail, so say so.
    return { ok: false, message: "Couldn't get ready to run that. Refresh the page and try again.", detail: 'headers() threw' };
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
      ? "You don't have permission to do that, or your session ended. Sign in again and retry."
      : res.status === 404
        ? "That couldn't be found, so nothing changed."
        : res.status >= 500
          ? 'The app had a problem running that. Nothing was confirmed; check before trying again.'
          : "That didn't go through. Check the details and try again.";
    return { ok: false, message, detail: String(res.status) };
  } catch {
    return { ok: false, message: "Couldn't reach the app to run that. Check your connection and try again.", detail: 'network error' };
  }
}
