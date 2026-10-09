import { describe, expect, it } from 'vitest';
import { attributeMatches, matchesTargeting, pathMatches, pickAgent, siteMatches, suggestionsFor } from './targeting';

const ctx = { path: '/billing/invoices', device: 'desktop' as const, bucket: 10 };

describe('pathMatches', () => {
  it.each([
    ['/billing/*', '/billing/invoices', true],
    ['/billing/*', '/billing', false],
    ['/billing', '/billing/', true],
    ['/billing', '/billing?tab=2', true],
    ['/*/reports', '/acme/reports', true],
    ['/settings', '/settings/team', false],
    ['/', '/', true],
    ['/a.b', '/axb', false], // dots are literal
  ])('%s vs %s → %s', (pattern, path, ok) => expect(pathMatches(pattern, path)).toBe(ok));
});

describe('matchesTargeting', () => {
  it('shows everywhere without rules', () => expect(matchesTargeting({}, ctx)).toBe(true));

  it('handles only and except pages', () => {
    expect(matchesTargeting({ pages: { mode: 'only', patterns: ['/billing/*'] } }, ctx)).toBe(true);
    expect(matchesTargeting({ pages: { mode: 'only', patterns: ['/docs/*'] } }, ctx)).toBe(false);
    expect(matchesTargeting({ pages: { mode: 'except', patterns: ['/billing/*'] } }, ctx)).toBe(false);
  });

  it('checks sign in state and attributes', () => {
    expect(matchesTargeting({ audience: 'signed_in' }, ctx)).toBe(false);
    expect(matchesTargeting({ audience: 'signed_out' }, ctx)).toBe(true);
    const user = { id: 'u1', plan: 'Trial', role: 'admin' };
    expect(matchesTargeting({ audience: 'signed_in', attributes: [{ key: 'plan', values: ['trial'] }] }, { ...ctx, user })).toBe(true);
    expect(matchesTargeting({ attributes: [{ key: 'plan', values: ['growth'] }] }, { ...ctx, user })).toBe(false);
    expect(matchesTargeting({ attributes: [{ key: 'team', values: ['x'] }] }, { ...ctx, user })).toBe(false);
  });

  it('checks device and rollout', () => {
    expect(matchesTargeting({ devices: 'mobile' }, ctx)).toBe(false);
    expect(matchesTargeting({ rollout: 20 }, ctx)).toBe(true); // bucket 10 is in the first 20%
    expect(matchesTargeting({ rollout: 5 }, ctx)).toBe(false);
  });
});

describe('pickAgent', () => {
  const main = { id: 'main', targeting: {} };
  const docs = { id: 'docs', targeting: { pages: { mode: 'only' as const, patterns: ['/docs/*'] } } };
  it('prefers the agent aimed at this page', () => {
    expect(pickAgent([main, docs], { ...ctx, path: '/docs/setup' })?.id).toBe('docs');
    expect(pickAgent([main, docs], ctx)?.id).toBe('main');
  });
  it('returns null when nothing matches', () => {
    expect(pickAgent([docs], ctx)).toBeNull();
  });
});

describe('suggestionsFor', () => {
  const titles = (list: { title: string }[]) => list.map((x) => x.title);
  const items = [
    { id: 'a', title: 'Set up late fees', rules: { sites: ['https://app.acme.com'], pages: { mode: 'only' as const, patterns: ['/billing/*'] } } },
    { id: 'b', title: 'Compare plans', rules: { pages: { mode: 'only' as const, patterns: ['/billing/*'] }, attributes: [{ key: 'plan', op: 'is_not' as const, values: ['enterprise'] }] } },
    { id: 'c', title: 'Invite your team', rules: { audience: 'signed_in' as const } },
    { id: 'd', title: 'Get started' },
  ];

  it('keeps the suggestions whose rules match this site, page and visitor, in order', () => {
    const app = { ...ctx, origin: 'https://app.acme.com', user: { id: 'u1', plan: 'trial' } };
    expect(titles(suggestionsFor({ items }, app))).toEqual(['Set up late fees', 'Compare plans', 'Invite your team', 'Get started']);
  });

  it('tells sites apart on the same path', () => {
    const site = { ...ctx, origin: 'https://acme.com' };
    expect(titles(suggestionsFor({ items }, site))).toEqual(['Compare plans', 'Get started']);
  });

  it('leaves out visitors on excluded plans', () => {
    const enterprise = { ...ctx, origin: 'https://acme.com', user: { id: 'u2', plan: 'Enterprise' } };
    expect(titles(suggestionsFor({ items }, enterprise))).toEqual(['Invite your team', 'Get started']);
  });

  it('still reads plain questions from older servers', () => {
    const s = { default: ['How do I start?'], pages: [{ pattern: '/billing/*', questions: ['How do refunds work?'] }] };
    expect(suggestionsFor(s, ctx)).toEqual([{ title: 'How do refunds work?' }]);
    expect(suggestionsFor(s, { ...ctx, path: '/home' })).toEqual([{ title: 'How do I start?' }]);
  });
});

describe('attributeMatches', () => {
  it('handles is and is not, including visitors without the value', () => {
    expect(attributeMatches({ key: 'plan', values: ['trial'] }, { id: '1', plan: 'trial' })).toBe(true);
    expect(attributeMatches({ key: 'plan', values: ['trial'] }, undefined)).toBe(false);
    expect(attributeMatches({ key: 'plan', op: 'is_not', values: ['enterprise'] }, undefined)).toBe(true);
    expect(attributeMatches({ key: 'tags', op: 'is_not', values: ['beta'] }, { id: '1', tags: ['early', 'beta'] })).toBe(false);
  });
});

describe('siteMatches', () => {
  it.each([
    [['https://app.acme.com'], 'https://app.acme.com', true],
    [['https://app.acme.com'], 'https://acme.com', false],
    [['https://*.acme.com'], 'https://docs.acme.com', true],
    [['https://*.acme.com'], 'https://acme.com', false],
    [['http://localhost:*'], 'http://localhost:3000', true],
    [['https://acme.com'], 'http://acme.com', false],
  ])('%j on %s is %s', (entries, origin, expected) => {
    expect(siteMatches(entries, origin)).toBe(expected);
  });
});

describe('hash routes', () => {
  it.each([
    ['/playground/#settings', '/playground/#settings', true],
    ['/playground/#settings', '/playground/#invoices', false],
    ['/playground/#*', '/playground/#customers', true],
    ['/playground/*', '/playground/#settings', false], // no # in the pattern: hash ignored, path is /playground
    ['/playground', '/playground/#settings', true],
  ])('%s vs %s → %s', (pattern, path, ok) => expect(pathMatches(pattern, path)).toBe(ok));
});

describe('attribute rules on tags and traits', () => {
  const user = { id: 'u', plan: 'growth', tags: ['beta', 'vip'], traits: { company: 'Acme', region: 'EU' } };
  it('matches any of the tags', () => {
    expect(matchesTargeting({ attributes: [{ key: 'tags', values: ['vip'] }] }, { ...ctx, user })).toBe(true);
    expect(matchesTargeting({ attributes: [{ key: 'tags', values: ['alpha'] }] }, { ...ctx, user })).toBe(false);
  });
  it('falls back to traits', () => {
    expect(matchesTargeting({ attributes: [{ key: 'region', values: ['eu'] }] }, { ...ctx, user })).toBe(true);
  });
});
