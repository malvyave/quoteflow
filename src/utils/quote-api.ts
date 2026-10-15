import { CoreApiClient } from 'twenty-client-sdk/core';

import { computeQuoteTotals, majorToMicros, microsToMajor } from 'src/utils/quote-totals';

export const DEFAULT_CURRENCY_CODE = 'USD';

// Editable values are kept as strings so inputs can be empty or mid-typing ("12.").
export type LineItemDraft = {
  key: string;
  id: string | null;
  name: string;
  quantity: string;
  unitPrice: string;
};

export type QuoteDraft = {
  id: string | null;
  name: string;
  status: string;
  currencyCode: string;
  discountPercent: string;
  taxPercent: string;
  lineItems: LineItemDraft[];
};

let nextKey = 0;

export const newLineItemDraft = (): LineItemDraft => ({
  key: `new-${nextKey++}`,
  id: null,
  name: '',
  quantity: '1',
  unitPrice: '',
});

export const parseNumber = (value: string) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

export const computeDraftTotals = (draft: QuoteDraft) =>
  computeQuoteTotals({
    lines: draft.lineItems.map((lineItem) => ({
      quantity: parseNumber(lineItem.quantity),
      unitPriceMicros: majorToMicros(parseNumber(lineItem.unitPrice)),
    })),
    discountPercent: parseNumber(draft.discountPercent),
    taxPercent: parseNumber(draft.taxPercent),
  });

// Loads the opportunity's most recent quote, or an unsaved draft if it has none.
export const loadQuoteDraft = async (opportunityId: string): Promise<QuoteDraft> => {
  const client = new CoreApiClient();

  const { opportunity, quotes } = await client.query({
    opportunity: {
      __args: { filter: { id: { eq: opportunityId } } },
      name: true,
      amount: { currencyCode: true },
    },
    quotes: {
      __args: {
        filter: { opportunityId: { eq: opportunityId } },
        orderBy: [{ createdAt: 'DescNullsLast' }],
        first: 1,
      },
      edges: {
        node: {
          id: true,
          name: true,
          status: true,
          currencyCode: true,
          discountPercent: true,
          taxPercent: true,
        },
      },
    },
  });

  const quote = quotes?.edges[0]?.node;

  if (!quote) {
    return {
      id: null,
      name: opportunity?.name ? `${opportunity.name} quote` : 'Quote',
      status: 'DRAFT',
      currencyCode: opportunity?.amount?.currencyCode || DEFAULT_CURRENCY_CODE,
      discountPercent: '0',
      taxPercent: '0',
      lineItems: [newLineItemDraft()],
    };
  }

  // Line items are fetched separately: the API rejects nesting one-to-many relations.
  const { quoteLineItems } = await client.query({
    quoteLineItems: {
      __args: {
        filter: { quoteId: { eq: quote.id } },
        orderBy: [{ position: 'AscNullsLast' }],
      },
      edges: {
        node: {
          id: true,
          name: true,
          quantity: true,
          unitPrice: { amountMicros: true },
        },
      },
    },
  });

  return {
    id: quote.id,
    name: quote.name ?? '',
    status: quote.status ?? 'DRAFT',
    currencyCode: quote.currencyCode || DEFAULT_CURRENCY_CODE,
    discountPercent: String(quote.discountPercent ?? 0),
    taxPercent: String(quote.taxPercent ?? 0),
    lineItems: (quoteLineItems?.edges ?? []).map(({ node }) => ({
      key: node.id,
      id: node.id,
      name: node.name ?? '',
      quantity: String(node.quantity ?? 1),
      unitPrice: String(microsToMajor(Number(node.unitPrice?.amountMicros ?? 0))),
    })),
  };
};

// Creates or updates the quote, then brings its line items in line with the draft.
export const saveQuoteDraft = async ({
  opportunityId,
  draft,
  removedLineItemIds,
}: {
  opportunityId: string;
  draft: QuoteDraft;
  removedLineItemIds: string[];
}): Promise<string> => {
  const client = new CoreApiClient();
  const totals = computeDraftTotals(draft);
  const currencyCode = draft.currencyCode;

  const quoteData = {
    name: draft.name.trim() || 'Quote',
    currencyCode,
    discountPercent: parseNumber(draft.discountPercent),
    taxPercent: parseNumber(draft.taxPercent),
    subtotal: { amountMicros: totals.subtotalMicros, currencyCode },
    total: { amountMicros: totals.totalMicros, currencyCode },
  };

  let quoteId = draft.id;

  if (quoteId === null) {
    const { createQuote } = await client.mutation({
      createQuote: { __args: { data: { ...quoteData, opportunityId } }, id: true },
    });

    if (!createQuote) {
      throw new Error('The quote could not be created.');
    }

    quoteId = createQuote.id;
  } else {
    await client.mutation({
      updateQuote: { __args: { id: quoteId, data: quoteData }, id: true },
    });
  }

  const lineItemData = (lineItem: LineItemDraft, position: number) => ({
    name: lineItem.name.trim(),
    quantity: parseNumber(lineItem.quantity),
    unitPrice: { amountMicros: majorToMicros(parseNumber(lineItem.unitPrice)), currencyCode },
    position,
  });

  const existingLineItems = draft.lineItems
    .map((lineItem, position) => ({ lineItem, position }))
    .filter(({ lineItem }) => lineItem.id !== null);
  const newLineItems = draft.lineItems
    .map((lineItem, position) => ({ lineItem, position }))
    .filter(({ lineItem }) => lineItem.id === null);

  await Promise.all([
    ...existingLineItems.map(({ lineItem, position }) =>
      client.mutation({
        updateQuoteLineItem: {
          __args: { id: lineItem.id as string, data: lineItemData(lineItem, position) },
          id: true,
        },
      }),
    ),
    newLineItems.length > 0
      ? client.mutation({
          createQuoteLineItems: {
            __args: {
              data: newLineItems.map(({ lineItem, position }) => ({
                ...lineItemData(lineItem, position),
                quoteId,
              })),
            },
            id: true,
          },
        })
      : null,
    removedLineItemIds.length > 0
      ? client.mutation({
          deleteQuoteLineItems: {
            __args: { filter: { id: { in: removedLineItemIds } } },
            id: true,
          },
        })
      : null,
  ]);

  return quoteId;
};
