import type { WalkthroughOffer } from '../types';
import { rulesMatch, type VisitContext } from './targeting';

/**
 * Walkthrough offers: which one, if any, to show on this visit. The server has the final say on
 * "once per visitor" (so a signed-in user isn't asked again on another device); this browser also
 * remembers answers, so a page never asks the server about an offer it already knows is done.
 */

const ANSWERED = '_sk_offers';
const VISITOR = '_sk_vid';
const THIS_VISIT = '_sk_offer_visit';

export type OfferAnswer = 'accepted' | 'dismissed';

/** Offers answered in this browser, by id. */
export function answeredOffers(): Record<string, OfferAnswer> {
  try {
    const saved = JSON.parse(localStorage.getItem(ANSWERED) ?? '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

export function rememberOffer(id: string, answer: OfferAnswer): void {
  try {
    localStorage.setItem(ANSWERED, JSON.stringify({ ...answeredOffers(), [id]: answer }));
  } catch {}
}

/** At most one offer a visit (a tab session). */
export function offeredThisVisit(): boolean {
  try {
    return sessionStorage.getItem(THIS_VISIT) === '1';
  } catch {
    return false;
  }
}

export function markOfferedThisVisit(): void {
  try {
    sessionStorage.setItem(THIS_VISIT, '1');
  } catch {}
}

/**
 * Who's seeing the offer: the signed-in user's id when the app passed one, otherwise a random id
 * kept in this browser. The server stores only a hash of it.
 */
export function offerVisitorKey(userId?: string): string {
  if (userId) return `u:${userId}`;
  try {
    let id = localStorage.getItem(VISITOR);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(VISITOR, id);
    }
    return `a:${id}`;
  } catch {
    return `a:${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * The first offer, in the order the team created them, that fits this visit: its trigger (this page,
 * or the event the app just reported), its rules, and not already answered here.
 */
export function offerFor(
  offers: WalkthroughOffer[] | undefined,
  ctx: VisitContext,
  opts: { event?: string; answered?: Record<string, OfferAnswer> } = {},
): WalkthroughOffer | null {
  const answered = opts.answered ?? {};
  return (
    (offers ?? []).find(
      (o) =>
        !answered[o.id] &&
        (opts.event
          ? o.trigger.kind === 'event' && o.trigger.name === opts.event
          : o.trigger.kind === 'page') &&
        rulesMatch(o.rules, ctx),
    ) ?? null
  );
}

/** The visitor is typing in the app (outside the widget): not the moment to interrupt. */
export function typingInApp(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el.closest('[data-skavelo-host], #skavelo-root')) return false;
  return el.matches('input, textarea, select') || el.isContentEditable;
}
