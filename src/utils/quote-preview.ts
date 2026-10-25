import { renderQuotePage, type PublicQuote, type QuoteSeller } from 'src/utils/public-quote-page';
import { parseNumber, type QuoteDraft } from 'src/utils/quote-api';
import { isQuoteExpired, toQuoteReference } from 'src/utils/quote-details';
import { majorToMicros } from 'src/utils/quote-totals';

// The editor's preview uses the same renderer as the public page, fed with the unsaved draft,
// so what the member sees is what the client will see.

export const toPreviewQuote = (draft: QuoteDraft, seller: QuoteSeller): PublicQuote => ({
  reference: draft.number !== null ? toQuoteReference('', draft.number) : 'Draft',
  name: draft.name.trim() || 'Quote',
  status: draft.status,
  currencyCode: draft.currencyCode,
  discountPercent: parseNumber(draft.discountPercent),
  taxPercent: parseNumber(draft.taxPercent),
  sentAt: draft.sentAt,
  acceptedAt: draft.acceptedAt,
  expiresAt: draft.expiresAt || null,
  message: draft.message,
  terms: draft.terms,
  client: draft.client,
  seller,
  // Rows without a description are not saved, so they are not shown either.
  lineItems: draft.lineItems
    .filter((lineItem) => lineItem.name.trim() !== '')
    .map((lineItem) => ({
      name: lineItem.name,
      quantity: parseNumber(lineItem.quantity),
      unitPriceMicros: majorToMicros(parseNumber(lineItem.unitPrice)),
    })),
});

export const renderDraftPreview = (draft: QuoteDraft, seller: QuoteSeller, now = new Date()) =>
  renderQuotePage({
    quote: toPreviewQuote(draft, seller),
    acceptActionUrl: '',
    isPreview: true,
    isExpired: isQuoteExpired(draft.expiresAt, now),
  });
