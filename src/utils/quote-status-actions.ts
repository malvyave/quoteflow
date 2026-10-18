import { CoreApiClient } from 'twenty-client-sdk/core';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { QuoteStatus } from 'src/objects/quote.object';
import { generatePublicToken } from 'src/utils/public-quote-token';

export { QUOTE_ACTIONS_ROUTE_PREFIX } from 'src/utils/public-quote-token';

type QuoteForAction = { id: string; status: string; lineItemCount: number };

export class QuoteActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Status fields are writable by the app only, so the write below runs as the app. Reading the
// quote first as the signed-in member makes sure they can see it before the app acts for them.
const loadQuoteAsMember = async (quoteId: unknown): Promise<QuoteForAction> => {
  if (typeof quoteId !== 'string' || quoteId === '') {
    throw new QuoteActionError('quoteId is required.', 400);
  }

  // A list query returns nothing for an unknown or inaccessible id, where a single-record
  // query would throw "Record not found".
  const { quotes, quoteLineItems } = await new CoreApiClient().query({
    quotes: {
      __args: { filter: { id: { eq: quoteId } }, first: 1 },
      edges: { node: { id: true, status: true } },
    },
    quoteLineItems: {
      __args: { filter: { quoteId: { eq: quoteId } }, first: 1 },
      edges: { node: { id: true } },
    },
  });
  const quote = quotes?.edges[0]?.node;

  if (!quote) {
    throw new QuoteActionError('Quote not found.', 404);
  }

  return {
    id: quote.id,
    status: quote.status ?? QuoteStatus.DRAFT,
    lineItemCount: quoteLineItems?.edges.length ?? 0,
  };
};

const updateQuoteAsApp = async (
  quoteId: string,
  data: {
    status: QuoteStatus.SENT | QuoteStatus.DRAFT;
    sentAt: string | null;
    publicToken: string | null;
  },
) => {
  await new CoreApiClient({ runAs: 'application' }).mutation({
    updateQuote: { __args: { id: quoteId, data }, id: true },
  });
};

export const sendQuoteAction = async (quoteId: unknown) => {
  const quote = await loadQuoteAsMember(quoteId);

  if (quote.status !== QuoteStatus.DRAFT) {
    throw new QuoteActionError('Only draft quotes can be sent.', 409);
  }

  if (quote.lineItemCount === 0) {
    throw new QuoteActionError('Add at least one line item before sending.', 422);
  }

  await updateQuoteAsApp(quote.id, {
    status: QuoteStatus.SENT,
    sentAt: new Date().toISOString(),
    publicToken: generatePublicToken(),
  });
};

// Clearing the token makes the old link stop working.
export const withdrawQuoteAction = async (quoteId: unknown) => {
  const quote = await loadQuoteAsMember(quoteId);

  if (quote.status !== QuoteStatus.SENT) {
    throw new QuoteActionError('Only sent quotes can be withdrawn.', 409);
  }

  await updateQuoteAsApp(quote.id, {
    status: QuoteStatus.DRAFT,
    sentAt: null,
    publicToken: null,
  });
};

export const runQuoteAction = async (
  event: RoutePayload,
  action: (quoteId: unknown) => Promise<void>,
) => {
  try {
    await action((event.body as { quoteId?: unknown } | null)?.quoteId);

    return { ok: true };
  } catch (error) {
    if (error instanceof QuoteActionError) {
      return new Response({ error: error.message }, { status: error.status });
    }

    throw error;
  }
};
