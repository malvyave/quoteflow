import { describe, expect, it } from 'vitest';

import {
  addDays,
  isQuoteExpired,
  toIsoDate,
  toQuoteReference,
  splitAddressSetting,
  toAddressLines,
  toSafeColor,
  toSafeImageUrl,
  toQuoteClient,
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

describe('toSafeColor', () => {
  it('accepts hex colors and normalizes them', () => {
    expect(toSafeColor('#1961ED')).toBe('#1961ed');
    expect(toSafeColor(' #abc ')).toBe('#abc');
  });

  it('rejects anything that is not a plain hex color', () => {
    expect(toSafeColor('red')).toBeNull();
    expect(toSafeColor('#12345')).toBeNull();
    expect(toSafeColor('#fff; background: url(x)')).toBeNull();
    expect(toSafeColor(undefined)).toBeNull();
  });
});

describe('toAddressLines', () => {
  it('formats a full address as letter lines', () => {
    expect(
      toAddressLines({
        addressStreet1: '1600 Amphitheatre Pkwy',
        addressStreet2: 'Building 40',
        addressCity: 'Mountain View',
        addressState: 'CA',
        addressPostcode: '94043',
        addressCountry: 'United States',
      }),
    ).toEqual(['1600 Amphitheatre Pkwy, Building 40', 'Mountain View, CA 94043', 'United States']);
  });

  it('leaves out empty parts', () => {
    expect(toAddressLines({ addressCity: 'Pune', addressCountry: ' ', addressPostcode: '' })).toEqual([
      'Pune',
    ]);
    expect(toAddressLines(null)).toEqual([]);
  });
});

describe('splitAddressSetting', () => {
  it('splits on commas and trims', () => {
    expect(splitAddressSetting('12 MG Road,  Bengaluru 560001 , India')).toEqual([
      '12 MG Road',
      'Bengaluru 560001',
      'India',
    ]);
    expect(splitAddressSetting('')).toEqual([]);
  });
});

describe('toQuoteClient', () => {
  it('combines the company and point of contact', () => {
    expect(
      toQuoteClient(
        { name: ' Acme Corp ', address: { addressCity: 'Pune', addressCountry: 'India' } },
        { name: { firstName: 'Samira', lastName: 'Hadid' }, emails: { primaryEmail: 'samira@acme.test' } },
      ),
    ).toEqual({
      companyName: 'Acme Corp',
      contactName: 'Samira Hadid',
      contactEmail: 'samira@acme.test',
      addressLines: ['Pune', 'India'],
    });
  });

  it('is empty when the deal has neither', () => {
    expect(toQuoteClient(null, undefined)).toEqual({
      companyName: null,
      contactName: null,
      contactEmail: null,
      addressLines: [],
    });
  });
});
