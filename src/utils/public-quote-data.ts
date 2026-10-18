import { CoreApiClient } from 'twenty-client-sdk/core';

import { DEFAULT_WON_STAGE } from 'src/constants/universal-identifiers';
import { QuoteStatus } from 'src/objects/quote.object';
import { toQuoteReference, type PublicQuote } from 'src/utils/public-quote-page';

export type PublicQuoteRecord = PublicQuote & {
  id: string;
  opportunityId: string | null;
  totalMicros: number;
};

// Public routes have no signed-in person, so this client acts as the app itself.
export const findQuoteByPublicToken = async (
  token: string,
): Promise<PublicQuoteRecord | null> => {
  const client = new CoreApiClient();

  const { quotes } = await client.query({
    quotes: {
      __args: { filter: { publicToken: { eq: token } }, first: 1 },
      edges: {
        node: {
          id: true,
          name: true,
          status: true,
          currencyCode: true,
          discountPercent: true,
          taxPercent: true,
          sentAt: true,
          acceptedAt: true,
          total: { amountMicros: true },
          opportunity: { id: true, companyId: true },
        },
      },
    },
  });

  const quote = quotes?.edges[0]?.node;

  if (!quote) {
    return null;
  }

  // Line items and the company are separate queries: relations nested two levels deep come back empty.
  const companyId = quote.opportunity?.companyId;
  const { quoteLineItems, company } = await client.query({
    quoteLineItems: {
      __args: {
        filter: { quoteId: { eq: quote.id } },
        orderBy: [{ position: 'AscNullsLast' }],
      },
      edges: {
        node: { name: true, quantity: true, unitPrice: { amountMicros: true } },
      },
    },
    ...(companyId
      ? { company: { __args: { filter: { id: { eq: companyId } } }, name: true } }
      : {}),
  });

  return {
    id: quote.id,
    opportunityId: quote.opportunity?.id ?? null,
    totalMicros: Number(quote.total?.amountMicros ?? 0),
    reference: toQuoteReference(quote.id),
    name: quote.name ?? 'Quote',
    status: quote.status ?? QuoteStatus.DRAFT,
    currencyCode: quote.currencyCode ?? 'USD',
    discountPercent: quote.discountPercent ?? 0,
    taxPercent: quote.taxPercent ?? 0,
    sentAt: quote.sentAt ?? null,
    acceptedAt: quote.acceptedAt ?? null,
    companyName: company?.name ?? null,
    lineItems: (quoteLineItems?.edges ?? []).map(({ node }) => ({
      name: node.name ?? '',
      quantity: node.quantity ?? 0,
      unitPriceMicros: Number(node.unitPrice?.amountMicros ?? 0),
    })),
  };
};

export const hasOtherAcceptedQuote = async (quote: PublicQuoteRecord) => {
  if (!quote.opportunityId) {
    return false;
  }

  const { quotes } = await new CoreApiClient().query({
    quotes: {
      __args: {
        filter: {
          opportunityId: { eq: quote.opportunityId },
          id: { neq: quote.id },
          status: { eq: QuoteStatus.ACCEPTED },
        },
        first: 1,
      },
      edges: { node: { id: true } },
    },
  });

  return (quotes?.edges.length ?? 0) > 0;
};

// The won stage is a workspace setting because pipelines can rename or remove "Customer".
// If the stage is rejected, the amount is still recorded so the acceptance is never half done.
const markOpportunityWon = async (client: CoreApiClient, quote: PublicQuoteRecord) => {
  if (!quote.opportunityId) {
    return;
  }

  const amount = { amountMicros: quote.totalMicros, currencyCode: quote.currencyCode };
  const wonStage = process.env.WON_STAGE?.trim() || DEFAULT_WON_STAGE;

  try {
    await client.mutation({
      updateOpportunity: {
        __args: {
          id: quote.opportunityId,
          data: { // Any value is allowed here: the server rejects one the pipeline lacks, handled below.
          stage: wonStage as 'CUSTOMER', amount },
        },
        id: true,
      },
    });
  } catch (error) {
    console.warn(
      `Could not set opportunity stage to "${wonStage}"; recording the amount only.`,
      error,
    );

    await client.mutation({
      updateOpportunity: { __args: { id: quote.opportunityId, data: { amount } }, id: true },
    });
  }
};

// Updates the opportunity first, so a failure can never leave an accepted quote on a deal that
// was not updated; retrying the acceptance completes it. Other open quotes on the deal are then
// superseded so only one can win.
export const acceptQuote = async (quote: PublicQuoteRecord) => {
  const client = new CoreApiClient();
  const acceptedAt = new Date().toISOString();

  await markOpportunityWon(client, quote);

  await client.mutation({
    updateQuote: {
      __args: { id: quote.id, data: { status: QuoteStatus.ACCEPTED, acceptedAt } },
      id: true,
    },
  });

  if (quote.opportunityId) {
    await client.mutation({
      updateQuotes: {
        __args: {
          filter: {
            opportunityId: { eq: quote.opportunityId },
            id: { neq: quote.id },
            status: { in: [QuoteStatus.DRAFT, QuoteStatus.SENT] },
          },
          data: { status: QuoteStatus.SUPERSEDED },
        },
        id: true,
      },
    });
  }

  return { ...quote, status: QuoteStatus.ACCEPTED, acceptedAt };
};
