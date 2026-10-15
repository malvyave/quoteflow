import { CoreApiClient } from 'twenty-client-sdk/core';

import { QuoteStatus } from 'src/objects/quote.object';
import { type PublicQuote } from 'src/utils/public-quote-page';

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

// Marks the quote accepted, then closes its opportunity as won at the quoted amount.
export const acceptQuote = async (quote: PublicQuoteRecord) => {
  const client = new CoreApiClient();
  const acceptedAt = new Date().toISOString();

  await client.mutation({
    updateQuote: {
      __args: { id: quote.id, data: { status: QuoteStatus.ACCEPTED, acceptedAt } },
      id: true,
    },
  });

  if (quote.opportunityId) {
    await client.mutation({
      updateOpportunity: {
        __args: {
          id: quote.opportunityId,
          data: {
            stage: 'CUSTOMER',
            amount: { amountMicros: quote.totalMicros, currencyCode: quote.currencyCode },
          },
        },
        id: true,
      },
    });
  }

  return { ...quote, status: QuoteStatus.ACCEPTED, acceptedAt };
};
