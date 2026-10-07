import { describe, expect, it } from 'vitest';
import { matchesTargeting, pathMatches, pickAgent, suggestionsFor } from './targeting';

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
  const s = { default: ['How do I start?'], pages: [{ pattern: '/billing/*', questions: ['How do refunds work?'] }] };
  it('uses page suggestions when the page matches', () => {
    expect(suggestionsFor(s, '/billing/invoices')).toEqual(['How do refunds work?']);
    expect(suggestionsFor(s, '/home')).toEqual(['How do I start?']);
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
