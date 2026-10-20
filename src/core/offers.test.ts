// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import type { WalkthroughOffer } from '../types';
import {
  answeredOffers, markOfferedThisVisit, offerFor, offeredThisVisit, offerVisitorKey, rememberOffer, typingInApp,
} from './offers';

const ctx = { path: '/invoices', device: 'desktop' as const, bucket: 10, origin: 'https://app.example.com' };
const offer = (id: string, more: Partial<WalkthroughOffer> = {}): WalkthroughOffer => ({
  id,
  workflowId: `wf-${id}`,
  message: 'New here? I can show you how to send your first invoice.',
  trigger: { kind: 'page' },
  rules: {},
  delaySeconds: 3,
  ...more,
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.body.innerHTML = '';
});

describe('offerFor', () => {
  it('picks the first offer whose rules fit the page', () => {
    const offers = [
      offer('billing', { rules: { pages: { mode: 'only', patterns: ['/billing/*'] } } }),
      offer('invoices', { rules: { pages: { mode: 'only', patterns: ['/invoices'] } } }),
      offer('later'),
    ];
    expect(offerFor(offers, ctx)?.id).toBe('invoices');
  });

  it('checks who the visitor is', () => {
    const trial = offer('trial', { rules: { audience: 'signed_in', attributes: [{ key: 'plan', values: ['trial'] }] } });
    expect(offerFor([trial], ctx)).toBeNull();
    expect(offerFor([trial], { ...ctx, user: { id: '1', plan: 'trial' } })?.id).toBe('trial');
    expect(offerFor([trial], { ...ctx, user: { id: '1', plan: 'growth' } })).toBeNull();
  });

  it('only offers event offers for their event, and page offers never for an event', () => {
    const offers = [offer('page'), offer('created', { trigger: { kind: 'event', name: 'project_created' } })];
    expect(offerFor(offers, ctx)?.id).toBe('page');
    expect(offerFor(offers, ctx, { event: 'project_created' })?.id).toBe('created');
    expect(offerFor(offers, ctx, { event: 'other' })).toBeNull();
  });

  it('skips offers this browser already answered', () => {
    rememberOffer('first', 'dismissed');
    expect(offerFor([offer('first'), offer('second')], ctx, { answered: answeredOffers() })?.id).toBe('second');
  });
});

describe('offer memory', () => {
  it('remembers answers and one offer a visit', () => {
    rememberOffer('a', 'accepted');
    rememberOffer('b', 'dismissed');
    expect(answeredOffers()).toEqual({ a: 'accepted', b: 'dismissed' });
    expect(offeredThisVisit()).toBe(false);
    markOfferedThisVisit();
    expect(offeredThisVisit()).toBe(true);
  });

  it('uses the signed-in id, or the same anonymous id on every visit', () => {
    expect(offerVisitorKey('42')).toBe('u:42');
    const anon = offerVisitorKey();
    expect(anon).toMatch(/^a:.+/);
    expect(offerVisitorKey()).toBe(anon);
  });

  it('knows when the visitor is typing in the app', () => {
    const input = document.createElement('input');
    document.body.append(input);
    expect(typingInApp()).toBe(false);
    input.focus();
    expect(typingInApp()).toBe(true);
  });
});
