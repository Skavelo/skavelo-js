import type { AttributeRule, Suggestion, SuggestionRules, Suggestions, Targeting, UserContext } from '../types';

/** What the widget knows about this visit when deciding whether to show. */
export interface VisitContext {
  path: string;
  user?: UserContext;
  device: 'desktop' | 'mobile';
  /** 0 to 99, stable for this browser, for gradual rollouts. */
  bucket: number;
  /** The site, like https://app.example.com, for rules aimed at one of several sites. */
  origin?: string;
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
  if (!(t.attributes ?? []).every((rule) => attributeMatches(rule, ctx.user))) return false;
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

/**
 * "plan is trial" passes when one of the visitor's values is listed; "plan is not enterprise" when
 * none is. A visitor without the value fails "is" and passes "is not".
 */
export function attributeMatches(rule: AttributeRule, user: UserContext | undefined): boolean {
  // Top level fields (plan, role, tags) first, then traits.
  const value = user?.[rule.key] ?? (user?.traits as Record<string, unknown> | undefined)?.[rule.key];
  const wanted = rule.values.map((v) => v.toLowerCase());
  const actual = value === undefined || value === null ? [] : (Array.isArray(value) ? value : [value]).map((v) => String(v).toLowerCase());
  const hit = actual.some((v) => wanted.includes(v));
  return rule.op === 'is_not' ? !hit : hit;
}

/**
 * Whether this site is one of the entries, in the same format as the agent's allowed sites:
 * https://app.example.com, https://*.example.com (subdomains only), http://localhost:*.
 */
export function siteMatches(entries: string[], origin: string): boolean {
  let here: URL;
  try { here = new URL(origin); } catch { return false; }
  return entries.some((entry) => {
    const m = /^(https?):\/\/(\*\.)?([^:/]+)(?::(\d+|\*))?\/?$/i.exec(entry.trim());
    if (!m) return false;
    const [, scheme, wildcard, host, port] = m;
    if (`${scheme.toLowerCase()}:` !== here.protocol) return false;
    const h = host.toLowerCase();
    const hostOk = wildcard ? here.hostname.endsWith(`.${h}`) : here.hostname === h;
    return hostOk && (port === '*' || (port ?? '') === here.port);
  });
}

function rulesMatch(r: SuggestionRules | undefined, ctx: VisitContext): boolean {
  if (!r) return true;
  if (r.sites?.length && !(ctx.origin && siteMatches(r.sites, ctx.origin))) return false;
  return matchesTargeting({ pages: r.pages, audience: r.audience, attributes: r.attributes, devices: r.devices }, ctx);
}

/** Up to four suggestions for this visit, in the order they were saved. */
export function suggestionsFor(s: Suggestions | undefined, ctx: VisitContext): Suggestion[] {
  if (!s) return [];
  if (Array.isArray(s.items)) return s.items.filter((item) => rulesMatch(item.rules, ctx)).slice(0, 4);
  // Older servers: this page's set, or the default set.
  const questions = s.pages?.find((p) => pathMatches(p.pattern, ctx.path))?.questions ?? s.default ?? [];
  return questions.slice(0, 4).map((title) => ({ title }));
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
