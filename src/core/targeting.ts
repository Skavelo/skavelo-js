import type { Suggestions, Targeting, UserContext } from '../types';

/** What the widget knows about this visit when deciding whether to show. */
export interface VisitContext {
  path: string;
  user?: UserContext;
  device: 'desktop' | 'mobile';
  /** 0 to 99, stable for this browser, for gradual rollouts. */
  bucket: number;
}

/**
 * Page patterns are paths: "/billing" matches /billing and /billing/; "*" matches anything,
 * so "/billing/*" covers every billing screen and "/*\/reports" any reports page one level down.
 */
export function pathMatches(pattern: string, path: string): boolean {
  const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/';
  // Patterns with a # also match the hash, for apps that route with #/screens.
  const [beforeHash, hash = ''] = path.split('#');
  const base = beforeHash.split('?')[0] || '/';
  const target = pattern.includes('#') ? `${norm(base)}#${hash}` : norm(base);
  const [pBase, pHash] = pattern.trim().split('#');
  const source = pHash === undefined ? norm(pBase) : `${norm(pBase)}#${pHash}`;
  const regex = new RegExp(`^${source.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 'i');
  return regex.test(target);
}

/** Every rule must pass. Countries were already checked by the API. */
export function matchesTargeting(t: Targeting | undefined, ctx: VisitContext): boolean {
  if (!t) return true;
  if (t.pages && t.pages.mode !== 'all') {
    const hit = t.pages.patterns.some((p) => pathMatches(p, ctx.path));
    if (t.pages.mode === 'only' ? !hit : hit) return false;
  }
  const signedIn = !!ctx.user?.id;
  if (t.audience === 'signed_in' && !signedIn) return false;
  if (t.audience === 'signed_out' && signedIn) return false;
  for (const rule of t.attributes ?? []) {
    // Top level fields (plan, role, tags) first, then traits.
    const value = ctx.user?.[rule.key] ?? (ctx.user?.traits as Record<string, unknown> | undefined)?.[rule.key];
    if (value === undefined || value === null) return false;
    const wanted = rule.values.map((v) => v.toLowerCase());
    const actual = (Array.isArray(value) ? value : [value]).map((v) => String(v).toLowerCase());
    if (!actual.some((v) => wanted.includes(v))) return false;
  }
  if (t.devices && t.devices !== 'all' && t.devices !== ctx.device) return false;
  if (t.rollout !== undefined && t.rollout < 100 && ctx.bucket >= t.rollout) return false;
  return true;
}

/**
 * With several agents on one site, the first that matches wins, but an agent aimed at specific
 * pages beats one that shows everywhere. So a docs agent on /docs/* wins there over the main one.
 */
export function pickAgent<T extends { targeting?: Targeting }>(agents: T[], ctx: VisitContext): T | null {
  const matching = agents.filter((a) => matchesTargeting(a.targeting, ctx));
  return matching.find((a) => a.targeting?.pages?.mode === 'only') ?? matching[0] ?? null;
}

/** The suggestions for this page: a page set whose pattern matches, or the default set. */
export function suggestionsFor(s: Suggestions | undefined, path: string): string[] {
  if (!s) return [];
  return s.pages.find((p) => pathMatches(p.pattern, path))?.questions ?? s.default;
}

export function currentDevice(): 'desktop' | 'mobile' {
  try {
    return window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 1024px)').matches ? 'mobile' : 'desktop';
  } catch {
    return 'desktop';
  }
}

/** A random number kept in this browser, so a 20% rollout shows to the same visitors every time. */
export function visitorBucket(): number {
  const key = '_sk_bucket';
  try {
    const saved = Number(localStorage.getItem(key));
    if (Number.isInteger(saved) && saved >= 0 && saved < 100 && localStorage.getItem(key) !== null) return saved;
    const fresh = Math.floor(Math.random() * 100);
    localStorage.setItem(key, String(fresh));
    return fresh;
  } catch {
    return Math.floor(Math.random() * 100);
  }
}

/** Calls back whenever the page's URL changes, including client side navigation in single page apps. */
export function watchUrl(onChange: () => void): () => void {
  const w = window as unknown as { __skUrlPatched?: boolean };
  if (!w.__skUrlPatched) {
    w.__skUrlPatched = true;
    for (const method of ['pushState', 'replaceState'] as const) {
      const original = history[method];
      history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
        const result = original.apply(this, args);
        window.dispatchEvent(new Event('skavelo:urlchange'));
        return result;
      };
    }
  }
  let last = location.href;
  const check = () => {
    if (location.href === last) return;
    last = location.href;
    onChange();
  };
  const events = ['skavelo:urlchange', 'popstate', 'hashchange'];
  events.forEach((e) => window.addEventListener(e, check));
  return () => events.forEach((e) => window.removeEventListener(e, check));
}
