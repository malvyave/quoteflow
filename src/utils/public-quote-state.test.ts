import { describe, expect, it } from 'vitest';

import { QuoteStatus } from 'src/objects/quote.object';
import { decideAcceptance, getPublicPageState } from 'src/utils/public-quote-state';

describe('getPublicPageState', () => {
  it('shows the quote only once it is sent or accepted', () => {
    expect(getPublicPageState(QuoteStatus.SENT)).toBe('quote');
    expect(getPublicPageState(QuoteStatus.ACCEPTED)).toBe('quote');
  });

  it('treats drafts and unknown statuses as not found', () => {
    expect(getPublicPageState(QuoteStatus.DRAFT)).toBe('not-found');
    expect(getPublicPageState(null)).toBe('not-found');
    expect(getPublicPageState('SOMETHING_ELSE')).toBe('not-found');
  });

  it('explains superseded and declined quotes instead of showing them', () => {
    expect(getPublicPageState(QuoteStatus.SUPERSEDED)).toBe('superseded');
    expect(getPublicPageState(QuoteStatus.DECLINED)).toBe('declined');
  });
});

describe('decideAcceptance', () => {
  it('accepts a sent quote when no other quote on the deal was accepted', () => {
    expect(decideAcceptance({ status: QuoteStatus.SENT, hasOtherAcceptedQuote: false, isExpired: false })).toBe(
      'accept',
    );
  });

  it('is idempotent for a quote that is already accepted', () => {
    expect(decideAcceptance({ status: QuoteStatus.ACCEPTED, hasOtherAcceptedQuote: false, isExpired: false })).toBe(
      'already-accepted',
    );
  });

  it('refuses when another quote on the same deal already won', () => {
    expect(decideAcceptance({ status: QuoteStatus.SENT, hasOtherAcceptedQuote: true, isExpired: false })).toBe(
      'unavailable',
    );
  });

  it('refuses drafts, superseded and declined quotes', () => {
    for (const status of [QuoteStatus.DRAFT, QuoteStatus.SUPERSEDED, QuoteStatus.DECLINED]) {
      expect(decideAcceptance({ status, hasOtherAcceptedQuote: false, isExpired: false })).toBe('unavailable');
    }
  });
});

describe('decideAcceptance with expiry', () => {
  it('refuses an expired sent quote', () => {
    expect(
      decideAcceptance({ status: QuoteStatus.SENT, hasOtherAcceptedQuote: false, isExpired: true }),
    ).toBe('expired');
  });

  it('still reports an accepted quote as accepted after its expiry date', () => {
    expect(
      decideAcceptance({
        status: QuoteStatus.ACCEPTED,
        hasOtherAcceptedQuote: false,
        isExpired: true,
      }),
    ).toBe('already-accepted');
  });
});
