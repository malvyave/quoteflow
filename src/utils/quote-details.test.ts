import { describe, expect, it } from 'vitest';

import {
  addDays,
  isQuoteExpired,
  toIsoDate,
  toQuoteReference,
  toSafeImageUrl,
} from 'src/utils/quote-details';

describe('toQuoteReference', () => {
  it('formats assigned numbers as Q-0001', () => {
    expect(toQuoteReference('fb2cede7-d0c0-478d-840d-520e170bf1d0', 1)).toBe('Q-0001');
    expect(toQuoteReference('fb2cede7-d0c0-478d-840d-520e170bf1d0', 12345)).toBe('Q-12345');
  });

  it('falls back to the id when no number is assigned yet', () => {
    expect(toQuoteReference('fb2cede7-d0c0-478d-840d-520e170bf1d0', null)).toBe('Q-FB2CEDE7');
    expect(toQuoteReference('fb2cede7-d0c0-478d-840d-520e170bf1d0')).toBe('Q-FB2CEDE7');
  });
});

describe('isQuoteExpired', () => {
  const now = new Date('2026-10-18T15:00:00.000Z');

  it('keeps a quote valid through its last day', () => {
    expect(isQuoteExpired('2026-10-18', now)).toBe(false);
    expect(isQuoteExpired('2026-11-01', now)).toBe(false);
  });

  it('expires the day after', () => {
    expect(isQuoteExpired('2026-10-17', now)).toBe(true);
  });

  it('never expires without a date', () => {
    expect(isQuoteExpired(null, now)).toBe(false);
    expect(isQuoteExpired('', now)).toBe(false);
  });

  it('accepts a full timestamp by comparing its date part', () => {
    expect(isQuoteExpired('2026-10-17T00:00:00.000Z', now)).toBe(true);
  });
});

describe('date helpers', () => {
  it('adds days and formats ISO dates', () => {
    expect(toIsoDate(addDays(new Date('2026-10-18T10:00:00.000Z'), 30))).toBe('2026-11-17');
  });
});

describe('toSafeImageUrl', () => {
  it('accepts http and https links', () => {
    expect(toSafeImageUrl(' https://acme.com/logo.png ')).toBe('https://acme.com/logo.png');
    expect(toSafeImageUrl('http://acme.com/logo.png')).toBe('http://acme.com/logo.png');
  });

  it('rejects other schemes and markup', () => {
    expect(toSafeImageUrl('javascript:alert(1)')).toBeNull();
    expect(toSafeImageUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(toSafeImageUrl('https://x.com/a.png" onerror="alert(1)')).toBeNull();
    expect(toSafeImageUrl('')).toBeNull();
    expect(toSafeImageUrl(null)).toBeNull();
  });
});
