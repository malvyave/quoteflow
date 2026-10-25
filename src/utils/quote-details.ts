import { type QuoteClient } from 'src/utils/public-quote-page';

// Small, pure helpers shared by the editor and the public quote page.

export const DEFAULT_VALIDITY_DAYS = 30;

// Sequential numbers are assigned when a quote is first sent. Older quotes and drafts fall
// back to a short id-based label so every quote has a stable reference.
export const toQuoteReference = (quoteId: string, quoteNumber?: number | null) =>
  typeof quoteNumber === 'number' && quoteNumber > 0
    ? `Q-${String(quoteNumber).padStart(4, '0')}`
    : `Q-${quoteId.slice(0, 8).toUpperCase()}`;

// Dates are compared as YYYY-MM-DD in UTC; a quote stays valid through its whole last day.
export const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

export const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

export const isQuoteExpired = (expiresAt: string | null | undefined, now: Date) =>
  typeof expiresAt === 'string' && expiresAt !== '' && toIsoDate(now) > expiresAt.slice(0, 10);

// Only absolute http(s) links are used as logos; anything else is ignored.
export const toSafeImageUrl = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? '';

  return /^https?:\/\/[^\s"'<>]+$/i.test(trimmed) ? trimmed : null;
};

// Brand colors go into the page's CSS, so only plain hex codes are accepted.
export const toSafeColor = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? '';

  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed.toLowerCase() : null;
};

export type PostalAddress = {
  addressStreet1?: string | null;
  addressStreet2?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostcode?: string | null;
  addressCountry?: string | null;
};

const joinParts = (parts: (string | null | undefined)[], separator: string) =>
  parts.map((part) => part?.trim() ?? '').filter(Boolean).join(separator);

// A Twenty address as the lines of a letter, leaving out empty parts.
export const toAddressLines = (address: PostalAddress | null | undefined) =>
  address
    ? [
        joinParts([address.addressStreet1, address.addressStreet2], ', '),
        joinParts([address.addressCity, joinParts([address.addressState, address.addressPostcode], ' ')], ', '),
        address.addressCountry?.trim() ?? '',
      ].filter(Boolean)
    : [];

// Settings are single-line text, so commas split the seller address into lines.
export const splitAddressSetting = (value: string | null | undefined) =>
  (value ?? '')
    .split(/\s*[,\n]\s*/)
    .map((line) => line.trim())
    .filter(Boolean);

// The deal's company and point of contact, as shown in a quote's "Prepared for" block.
type ClientCompany = { name?: string | null; address?: PostalAddress | null };
type ClientContact = {
  name?: { firstName?: string | null; lastName?: string | null } | null;
  emails?: { primaryEmail?: string | null } | null;
};

export const toQuoteClient = (
  company: ClientCompany | null | undefined,
  contact: ClientContact | null | undefined,
): QuoteClient => ({
  companyName: company?.name?.trim() || null,
  contactName:
    [contact?.name?.firstName, contact?.name?.lastName]
      .map((part) => part?.trim() ?? '')
      .filter(Boolean)
      .join(' ') || null,
  contactEmail: contact?.emails?.primaryEmail?.trim() || null,
  addressLines: toAddressLines(company?.address),
});
