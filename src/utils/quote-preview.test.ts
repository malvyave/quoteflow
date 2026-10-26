import { describe, expect, it } from 'vitest';

import { EMPTY_CLIENT, EMPTY_SELLER } from 'src/utils/public-quote-page';
import { type QuoteDraft } from 'src/utils/quote-api';
import { renderDraftPreview, toPreviewQuote } from 'src/utils/quote-preview';
import { majorToMicros } from 'src/utils/quote-totals';

const draft = (overrides: Partial<QuoteDraft> = {}): QuoteDraft => ({
  id: null,
  name: 'Website Redesign',
  status: 'DRAFT',
  publicToken: null,
  number: null,
  sentAt: null,
  acceptedAt: null,
  acceptedByName: null,
  viewedAt: null,
  declinedAt: null,
  declineReason: null,
  client: { ...EMPTY_CLIENT, companyName: 'Acme Corp' },
  currencyCode: 'USD',
  discountPercent: '10',
  taxPercent: '18',
  expiresAt: '2026-11-20',
  message: 'Thanks!',
  terms: 'Net 30.',
  lineItems: [
    { key: 'a', id: null, name: 'Homepage redesign', quantity: '1', unitPrice: '4000' },
    { key: 'b', id: null, name: 'Mobile version', quantity: '1', unitPrice: '2500' },
    { key: 'c', id: null, name: '   ', quantity: '1', unitPrice: '99' },
  ],
  ...overrides,
});

const seller = { ...EMPTY_SELLER, name: 'Northwind Studio' };

describe('toPreviewQuote', () => {
  it('converts the editable strings into the public quote shape', () => {
    const quote = toPreviewQuote(draft(), seller);

    expect(quote.discountPercent).toBe(10);
    expect(quote.taxPercent).toBe(18);
    expect(quote.lineItems[0]).toEqual({
      name: 'Homepage redesign',
      quantity: 1,
      unitPriceMicros: majorToMicros(4000),
    });
    expect(quote.seller).toBe(seller);
  });

  it('leaves out rows without a description, like saving does', () => {
    expect(toPreviewQuote(draft(), seller).lineItems.map((lineItem) => lineItem.name)).toEqual([
      'Homepage redesign',
      'Mobile version',
    ]);
  });

  it('labels unsent quotes Draft and numbered ones with their reference', () => {
    expect(toPreviewQuote(draft(), seller).reference).toBe('Draft');
    expect(toPreviewQuote(draft({ number: 7 }), seller).reference).toBe('Q-0007');
  });

  it('treats half-typed numbers as zero instead of breaking', () => {
    const quote = toPreviewQuote(
      draft({ discountPercent: '', lineItems: [{ key: 'a', id: null, name: 'Item', quantity: '.', unitPrice: '' }] }),
      seller,
    );

    expect(quote.discountPercent).toBe(0);
    expect(quote.lineItems[0]).toMatchObject({ quantity: 0, unitPriceMicros: 0 });
  });
});

describe('renderDraftPreview', () => {
  it('renders the same totals the client will see, marked as a preview', () => {
    const html = renderDraftPreview(draft(), seller, new Date('2026-10-22T10:00:00Z'));

    expect(html).toContain('$6,903.00');
    expect(html).toContain('Preview — this is what your client will see');
    expect(html).toContain('Northwind Studio');
    expect(html).not.toContain('<form');
  });

  it('shows the expiry notice when the valid-until date has passed', () => {
    const html = renderDraftPreview(draft({ expiresAt: '2026-10-01' }), seller, new Date('2026-10-22T10:00:00Z'));

    expect(html).toContain('This quote expired on October 1, 2026');
  });
});
