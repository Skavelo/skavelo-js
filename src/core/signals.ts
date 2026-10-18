import type { FailedRequest, PageSignals } from '../types';
import { ERRORS, PRESSABLE, errorText, hidden, isDisabled, labelOf, reasonFor } from './stuck';

/**
 * Evidence for "why isn't this working?", gathered in the visitor's browser and sent with each
 * question:
 * - errors on screen: alerts, error toasts and invalid fields, read with the stuck detector's rules;
 * - the app's requests that failed in the last 2 minutes: method, path and status only;
 * - switched off buttons, with the reason the app gives.
 * Request and response bodies, headers and query strings are never read. Text inside
 * data-sk-sensitive, password fields and the widget itself stays out, as everywhere else.
 */

const MAX_ERRORS = 5;
const MAX_REQUESTS = 5;
const MAX_DISABLED = 5;
const RECENT_MS = 2 * 60_000;
/** Kept in memory only, newest last. */
const BUFFER = 20;

const failures: (FailedRequest & { t: number })[] = [];
let wrapped = false;
/** Requests to these origins are Skavelo's own and never recorded. */
const ignoredOrigins = new Set<string>();

/**
 * IDs and tokens in a path say nothing about the problem and can identify someone, so they become
 * :id. /broadcasts/8213/send and /invite/eyJhbGci... both keep only their shape.
 */
export function tidyPath(raw: string): string {
  return raw
    .split('/')
    .map((part) => {
      if (!part) return part;
      if (/^\d+$/.test(part) || /^[0-9a-f-]{16,}$/i.test(part) || part.length > 24 || /@/.test(part)) return ':id';
      return part;
    })
    .join('/')
    .slice(0, 160);
}

export function recordRequest(method: string, url: string, status: number, now = Date.now()) {
  let parsed: URL;
  try {
    parsed = new URL(url, window.location.href);
  } catch {
    return;
  }
  if (ignoredOrigins.has(parsed.origin)) return;
  const sameOrigin = parsed.origin === window.location.origin;
  // A blocked analytics script on another site fails with no status; that's noise, not the app.
  if (status === 0 && !sameOrigin) return;
  if (status !== 0 && status < 400) return;
  failures.push({
    method: method.toUpperCase().slice(0, 8),
    path: tidyPath(parsed.pathname),
    ...(sameOrigin ? {} : { host: parsed.host.slice(0, 80) }),
    status,
    t: now,
  });
  if (failures.length > BUFFER) failures.shift();
}

/**
 * Watches fetch and XMLHttpRequest for failures, once per page. The wrappers only look at the
 * outcome; the request goes through unchanged and errors reach the app as before.
 */
export function watchRequests(skaveloApi: string) {
  try {
    ignoredOrigins.add(new URL(skaveloApi, window.location.href).origin);
  } catch {
    // An odd apiUrl only means Skavelo's own requests could be recorded.
  }
  if (wrapped || typeof window === 'undefined') return;
  wrapped = true;

  const original = window.fetch;
  if (typeof original === 'function') {
    window.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      const url = input instanceof Request ? input.url : String(input);
      const pending = original.call(this, input, init);
      pending.then(
        (res) => recordRequest(method, url, res.status),
        (err) => {
          // Stopped on purpose by the app: not a failure.
          if ((err as { name?: string })?.name !== 'AbortError') recordRequest(method, url, 0);
        },
      );
      return pending;
    } as typeof window.fetch;
  }

  const XHR = window.XMLHttpRequest?.prototype;
  if (XHR) {
    const open = XHR.open;
    const send = XHR.send;
    XHR.open = function (this: XMLHttpRequest & { _sk?: [string, string] }, method: string, url: string | URL, ...rest: unknown[]) {
      this._sk = [method, String(url)];
      return (open as (...a: unknown[]) => void).call(this, method, url, ...rest);
    } as typeof XHR.open;
    XHR.send = function (this: XMLHttpRequest & { _sk?: [string, string] }, body?: Document | XMLHttpRequestBodyInit | null) {
      const meta = this._sk;
      if (meta) {
        this.addEventListener('loadend', () => {
          // status 0 after an abort is the app's choice, not a failure.
          if (this.status === 0 && (this as { _skAborted?: boolean })._skAborted) return;
          recordRequest(meta[0], meta[1], this.status);
        });
        this.addEventListener('abort', () => { (this as { _skAborted?: boolean })._skAborted = true; });
      }
      return send.call(this, body);
    };
  }
}

/** For tests. */
export function clearRequests() {
  failures.length = 0;
}

const clean = (text: string, max: number) => text.replace(/\s+/g, ' ').trim().slice(0, max);

/** What the visitor's screen shows right now that could explain a problem. */
export function collectPageSignals(now = Date.now()): PageSignals {
  const errors: string[] = [];
  for (const el of Array.from(document.querySelectorAll(ERRORS))) {
    if (errors.length >= MAX_ERRORS) break;
    if (hidden(el) || (el as HTMLElement).hidden || el.closest('[aria-hidden="true"]')) continue;
    if (el instanceof HTMLInputElement && el.type === 'password') continue;
    const text = clean(errorText(el), 200);
    if (text.length >= 4 && !errors.includes(text)) errors.push(text);
  }

  const disabled: { label: string; reason?: string }[] = [];
  for (const el of Array.from(document.querySelectorAll(PRESSABLE))) {
    if (disabled.length >= MAX_DISABLED) break;
    if (!isDisabled(el) || hidden(el) || (el as HTMLElement).hidden) continue;
    const label = labelOf(el);
    if (!label || disabled.some((d) => d.label === label)) continue;
    const reason = reasonFor(el);
    disabled.push(reason ? { label, reason } : { label });
  }

  const failedRequests = failures
    .filter((f) => now - f.t <= RECENT_MS)
    .slice(-MAX_REQUESTS)
    .map(({ t, ...f }) => ({ ...f, secondsAgo: Math.max(0, Math.round((now - t) / 1000)) }));

  return {
    ...(errors.length ? { errors } : {}),
    ...(failedRequests.length ? { failedRequests } : {}),
    ...(disabled.length ? { disabled } : {}),
  };
}
