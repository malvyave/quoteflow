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
