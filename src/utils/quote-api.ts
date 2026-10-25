import { CoreApiClient } from 'twenty-client-sdk/core';
import { RestApiClient, RestApiClientError } from 'twenty-client-sdk/rest';

import { QUOTE_ACTIONS_ROUTE_PREFIX } from 'src/utils/public-quote-token';
import { type PlanStatus } from 'src/utils/billing';
import { type QuoteClient } from 'src/utils/public-quote-page';
import { addDays, DEFAULT_VALIDITY_DAYS, toIsoDate, toQuoteClient } from 'src/utils/quote-details';
import { computeQuoteTotals, majorToMicros, microsToMajor } from 'src/utils/quote-totals';

export const DEFAULT_CURRENCY_CODE = 'USD';

// Editable values are kept as strings so inputs can be empty or mid-typing ("12.").
// Typed by hand so this compiles before the app's client has been generated.
type LineItemNode = {
  id: string;
  name?: string | null;
  quantity?: number | null;
  unitPrice?: { amountMicros?: number | string | null } | null;
};

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
  publicToken: string | null;
  // Set by the app when the quote is first sent; read-only here.
  number: number | null;
  sentAt: string | null;
  acceptedAt: string | null;
  // Who the quote is for, from the deal; shown in the preview, not saved from the editor.
  client: QuoteClient;
  currencyCode: string;
  discountPercent: string;
  taxPercent: string;
  // YYYY-MM-DD, or '' for no expiry.
  expiresAt: string;
  message: string;
  terms: string;
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

export type QuoteDefaults = { message: string; terms: string };

// Loads the opportunity's most recent quote, or an unsaved draft if it has none. New drafts
// start from the workspace's default message and terms.
export const loadQuoteDraft = async (
  opportunityId: string,
  defaults: QuoteDefaults = { message: '', terms: '' },
): Promise<QuoteDraft> => {
  const client = new CoreApiClient();

  const { opportunity, quotes } = await client.query({
    opportunity: {
      __args: { filter: { id: { eq: opportunityId } } },
      name: true,
      amount: { currencyCode: true },
      company: {
        name: true,
        address: {
          addressStreet1: true,
          addressStreet2: true,
          addressCity: true,
          addressState: true,
          addressPostcode: true,
          addressCountry: true,
        },
      },
      pointOfContact: { name: { firstName: true, lastName: true }, emails: { primaryEmail: true } },
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
          publicToken: true,
          number: true,
          sentAt: true,
          acceptedAt: true,
          currencyCode: true,
          discountPercent: true,
          taxPercent: true,
          expiresAt: true,
          message: true,
          terms: true,
        },
      },
    },
  });

  const quote = quotes?.edges[0]?.node;
  const quoteClient = toQuoteClient(opportunity?.company, opportunity?.pointOfContact);

  if (!quote) {
    return {
      id: null,
      name: opportunity?.name ? `${opportunity.name} quote` : 'Quote',
      status: 'DRAFT',
      publicToken: null,
      number: null,
      sentAt: null,
      acceptedAt: null,
      client: quoteClient,
      currencyCode: opportunity?.amount?.currencyCode || DEFAULT_CURRENCY_CODE,
      discountPercent: '0',
      taxPercent: '0',
      expiresAt: toIsoDate(addDays(new Date(), DEFAULT_VALIDITY_DAYS)),
      message: defaults.message,
      terms: defaults.terms,
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
    publicToken: quote.publicToken ?? null,
    number: quote.number ?? null,
    sentAt: quote.sentAt ?? null,
    acceptedAt: quote.acceptedAt ?? null,
    client: quoteClient,
    currencyCode: quote.currencyCode || DEFAULT_CURRENCY_CODE,
    discountPercent: String(quote.discountPercent ?? 0),
    taxPercent: String(quote.taxPercent ?? 0),
    expiresAt: quote.expiresAt?.slice(0, 10) ?? '',
    message: quote.message ?? '',
    terms: quote.terms ?? '',
    lineItems: (quoteLineItems?.edges ?? []).map(({ node }: { node: LineItemNode }) => ({
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
    expiresAt: draft.expiresAt || null,
    message: draft.message.trim() || null,
    terms: draft.terms.trim() || null,
    subtotal: { amountMicros: totals.subtotalMicros, currencyCode },
    total: { amountMicros: totals.totalMicros, currencyCode },
  };

  let quoteId: string;

  if (draft.id === null) {
    const { createQuote } = await client.mutation({
      createQuote: { __args: { data: { ...quoteData, opportunityId } }, id: true },
    });

    if (!createQuote) {
      throw new Error('The quote could not be created.');
    }

    quoteId = createQuote.id;
  } else {
    quoteId = draft.id;
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

// Status changes go through the app's server functions: those fields are writable by the app only.
const runQuoteAction = async (action: 'send' | 'withdraw', quoteId: string) => {
  try {
    await new RestApiClient().post(`/s${QUOTE_ACTIONS_ROUTE_PREFIX}/${action}`, { quoteId });
  } catch (error) {
    const message =
      error instanceof RestApiClientError
        ? (error.body as { error?: string } | undefined)?.error
        : undefined;

    throw new Error(message ?? `Could not ${action} the quote.`);
  }
};

export const sendQuote = (quoteId: string) => runQuoteAction('send', quoteId);

export const withdrawQuote = (quoteId: string) => runQuoteAction('withdraw', quoteId);

export type { PlanStatus } from 'src/utils/billing';

export const loadPlanStatus = () =>
  new RestApiClient().get<PlanStatus>(`/s${QUOTE_ACTIONS_ROUTE_PREFIX}/plan`);

export const startUpgrade = async () => {
  try {
    return await new RestApiClient().post<{ kind: 'checkout' | 'portal'; url: string }>(
      `/s${QUOTE_ACTIONS_ROUTE_PREFIX}/upgrade`,
    );
  } catch (error) {
    const message =
      error instanceof RestApiClientError
        ? (error.body as { error?: string } | undefined)?.error
        : undefined;

    throw new Error(message ?? 'Could not open billing.');
  }
};
