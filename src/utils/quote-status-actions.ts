import { CoreApiClient } from 'twenty-client-sdk/core';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { QuoteStatus } from 'src/objects/quote.object';
import { generatePublicToken } from 'src/utils/public-quote-token';
import { isQuoteExpired } from 'src/utils/quote-details';

export { QUOTE_ACTIONS_ROUTE_PREFIX } from 'src/utils/public-quote-token';

type QuoteForAction = {
  id: string;
  status: string;
  number: number | null;
  expiresAt: string | null;
  lineItemCount: number;
};

const MAX_NUMBERING_ATTEMPTS = 5;

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
      edges: { node: { id: true, status: true, number: true, expiresAt: true } },
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
    number: quote.number ?? null,
    expiresAt: quote.expiresAt ?? null,
    lineItemCount: quoteLineItems?.edges.length ?? 0,
  };
};

const updateQuoteAsApp = async (
  quoteId: string,
  data: {
    status: QuoteStatus.SENT | QuoteStatus.DRAFT;
    sentAt: string | null;
    publicToken: string | null;
    number?: number;
  },
) => {
  await new CoreApiClient({ runAs: 'application' }).mutation({
    updateQuote: { __args: { id: quoteId, data }, id: true },
  });
};

// Runs as the app so it sees every quote in the workspace, not only the member's.
const findHighestQuoteNumber = async () => {
  const { quotes } = await new CoreApiClient({ runAs: 'application' }).query({
    quotes: {
      __args: { orderBy: [{ number: 'DescNullsLast' }], first: 1 },
      edges: { node: { number: true } },
    },
  });

  return quotes?.edges[0]?.node.number ?? 0;
};

const isUniqueViolation = (error: unknown) =>
  /duplicate|unique/i.test(error instanceof Error ? error.message : String(error));

export const sendQuoteAction = async (quoteId: unknown) => {
  const quote = await loadQuoteAsMember(quoteId);

  if (quote.status !== QuoteStatus.DRAFT) {
    throw new QuoteActionError('Only draft quotes can be sent.', 409);
  }

  if (quote.lineItemCount === 0) {
    throw new QuoteActionError('Add at least one line item before sending.', 422);
  }

  if (isQuoteExpired(quote.expiresAt, new Date())) {
    throw new QuoteActionError('The "valid until" date is in the past. Pick a later date.', 422);
  }

  const sendData = {
    status: QuoteStatus.SENT as const,
    sentAt: new Date().toISOString(),
    publicToken: generatePublicToken(),
  };

  // A quote withdrawn and sent again keeps its number.
  if (quote.number !== null) {
    await updateQuoteAsApp(quote.id, sendData);

    return;
  }

  // The unique index settles races between two sends: on a clash, try the next number.
  // Deleted quotes can still hold numbers the query does not return, hence counting up.
  let candidate = (await findHighestQuoteNumber()) + 1;

  for (let attempt = 1; ; attempt++) {
    try {
      await updateQuoteAsApp(quote.id, { ...sendData, number: candidate });

      return;
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= MAX_NUMBERING_ATTEMPTS) {
        throw error;
      }

      candidate++;
    }
  }
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
