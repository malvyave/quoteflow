import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { computeQuoteTotals, majorToMicros } from 'src/utils/quote-totals';

// Talks to a running Twenty server the way a member and a client would: GraphQL with the
// test API key for setup, the app's HTTP routes for actions, and plain fetches for the
// public client page.

const apiUrl = () => {
  const url = process.env.TWENTY_API_URL;

  if (!url) {
    throw new Error('TWENTY_API_URL must be set for integration tests.');
  }

  return url.replace(/\/$/, '');
};

const authHeaders = () => ({
  Authorization: `Bearer ${process.env.TWENTY_API_KEY}`,
  'Content-Type': 'application/json',
});

type GraphqlResult<T> = { data?: T; errors?: { message: string }[] };

const postGraphql = async <T>(
  endpoint: 'graphql' | 'metadata',
  query: string,
  variables?: Record<string, unknown>,
): Promise<GraphqlResult<T>> => {
  const response = await fetch(`${apiUrl()}/${endpoint}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ query, variables }),
  });

  return (await response.json()) as GraphqlResult<T>;
};

// Records live on /graphql; apps, objects and app variables on /metadata.
export const gql = <T = Record<string, unknown>>(query: string, variables?: Record<string, unknown>) =>
  postGraphql<T>('graphql', query, variables);

export const metadata = <T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
) => postGraphql<T>('metadata', query, variables);

export const gqlData = async <T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> => {
  const result = await gql<T>(query, variables);

  if (result.errors?.length || !result.data) {
    throw new Error(`GraphQL error: ${result.errors?.map((error) => error.message).join('; ')}`);
  }

  return result.data;
};

// Test deals are prefixed so leftovers are easy to spot; screenshots pass `exactName`.
export const createDeal = async (
  name: string,
  stage = 'PROPOSAL',
  { exactName = false, amount = 1 }: { exactName?: boolean; amount?: number } = {},
) => {
  const data = await gqlData<{ createOpportunity: { id: string } }>(
    `mutation($d: OpportunityCreateInput!) { createOpportunity(data: $d) { id } }`,
    {
      d: {
        name: exactName ? name : `[QuoteFlow test] ${name}`,
        stage,
        amount: { amountMicros: majorToMicros(amount), currencyCode: 'USD' },
      },
    },
  );

  return data.createOpportunity.id;
};

export type TestLine = { name: string; quantity: number; unitPrice: number };

export const createQuote = async (
  opportunityId: string,
  {
    name = 'Test quote',
    lines = [{ name: 'Homepage redesign', quantity: 1, unitPrice: 4000 }],
    discountPercent = 0,
    taxPercent = 0,
    expiresAt = null,
    message = null,
    terms = null,
  }: {
    name?: string;
    lines?: TestLine[];
    discountPercent?: number;
    taxPercent?: number;
    expiresAt?: string | null;
    message?: string | null;
    terms?: string | null;
  } = {},
) => {
  const totals = computeQuoteTotals({
    lines: lines.map((line) => ({
      quantity: line.quantity,
      unitPriceMicros: majorToMicros(line.unitPrice),
    })),
    discountPercent,
    taxPercent,
  });

  const { createQuote: quote } = await gqlData<{ createQuote: { id: string } }>(
    `mutation($d: QuoteCreateInput!) { createQuote(data: $d) { id } }`,
    {
      d: {
        name,
        opportunityId,
        currencyCode: 'USD',
        discountPercent,
        taxPercent,
        expiresAt,
        message,
        terms,
        subtotal: { amountMicros: totals.subtotalMicros, currencyCode: 'USD' },
        total: { amountMicros: totals.totalMicros, currencyCode: 'USD' },
      },
    },
  );

  if (lines.length > 0) {
    await gqlData(
      `mutation($d: [QuoteLineItemCreateInput!]!) { createQuoteLineItems(data: $d) { id } }`,
      {
        d: lines.map((line, position) => ({
          name: line.name,
          quantity: line.quantity,
          unitPrice: { amountMicros: majorToMicros(line.unitPrice), currencyCode: 'USD' },
          quoteId: quote.id,
          position,
        })),
      },
    );
  }

  return quote.id;
};

export type QuoteRecord = {
  id: string;
  status: string;
  number: number | null;
  publicToken: string | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
  viewedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
};

export const getQuote = async (quoteId: string) => {
  const data = await gqlData<{ quotes: { edges: { node: QuoteRecord }[] } }>(
    `query($id: UUID!) { quotes(filter: { id: { eq: $id } }) {
      edges { node { id status number publicToken acceptedAt acceptedByName viewedAt declinedAt declineReason } } } }`,
    { id: quoteId },
  );

  const quote = data.quotes.edges[0]?.node;

  if (!quote) {
    throw new Error(`Quote ${quoteId} not found`);
  }

  return quote;
};

export const getDeal = async (opportunityId: string) => {
  const data = await gqlData<{
    opportunities: { edges: { node: { stage: string; amount: { amountMicros: number } } }[] };
  }>(
    `query($id: UUID!) { opportunities(filter: { id: { eq: $id } }) {
      edges { node { stage amount { amountMicros } } } } }`,
    { id: opportunityId },
  );

  return data.opportunities.edges[0]?.node;
};

export const callQuoteAction = async (
  action: 'send' | 'withdraw',
  body: unknown,
  { authenticated = true } = {},
) => {
  const response = await fetch(`${apiUrl()}/s/quote-actions/${action}`, {
    method: 'POST',
    headers: authenticated ? authHeaders() : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return { status: response.status, body: await response.text() };
};

export const sendQuote = async (quoteId: string) => {
  const result = await callQuoteAction('send', { quoteId });

  if (result.status !== 200) {
    throw new Error(`Sending quote failed with ${result.status}: ${result.body}`);
  }

  const quote = await getQuote(quoteId);

  if (!quote.publicToken) {
    throw new Error('Sent quote has no public token');
  }

  return quote.publicToken;
};

export const publicQuoteUrl = (token: string) => `${apiUrl()}/s/quote/${token}`;

export const viewPublicQuote = async (token: string, query = '') => {
  const response = await fetch(`${publicQuoteUrl(token)}${query}`);

  return { status: response.status, html: await response.text() };
};

// Posts the client's form the way a browser does.
const postPublicForm = async (url: string, fields: Record<string, string>) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });

  return { status: response.status, html: await response.text() };
};

export const acceptPublicQuote = (token: string, fields: Record<string, string> = {}) =>
  postPublicForm(`${publicQuoteUrl(token)}/accept`, fields);

export const declinePublicQuote = (token: string, fields: Record<string, string> = {}) =>
  postPublicForm(`${publicQuoteUrl(token)}/decline`, fields);

// Timeline events QuoteFlow added to a deal, by the label of their type.
export const getDealTimelineLabels = async (opportunityId: string) => {
  const data = await gqlData<{
    timelineActivities: { edges: { node: { timelineActivityTypeSnapshot: { label?: string } | null } }[] };
  }>(
    `query($id: UUID!) { timelineActivities(filter: { targetOpportunityId: { eq: $id } }, first: 50) {
      edges { node { timelineActivityTypeSnapshot } } } }`,
    { id: opportunityId },
  );

  return data.timelineActivities.edges
    .map(({ node }) => node.timelineActivityTypeSnapshot?.label)
    .filter((label): label is string => typeof label === 'string');
};

// Opportunities cascade-delete their quotes, and quotes their line items.
export const destroyDeals = async (opportunityIds: string[]) => {
  for (const id of opportunityIds) {
    await gql(`mutation($id: UUID!) { destroyOpportunity(id: $id) { id } }`, { id });
  }
};

export const isoDateFromToday = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Server variables (billing keys) belong to the app registration, not the workspace install.
export const setServerVariable = async (key: string, value: string | null) => {
  const lookup = await metadata<{
    findApplicationRegistrationByUniversalIdentifier: { id: string } | null;
  }>(`query($id: String!) { findApplicationRegistrationByUniversalIdentifier(universalIdentifier: $id) { id } }`, {
    id: APPLICATION_UNIVERSAL_IDENTIFIER,
  });
  const registrationId = lookup.data?.findApplicationRegistrationByUniversalIdentifier?.id;

  if (!registrationId) {
    throw new Error('QuoteFlow registration not found');
  }

  const variables = await metadata<{
    findApplicationRegistrationVariables: { id: string; key: string }[];
  }>(`query($id: String!) { findApplicationRegistrationVariables(applicationRegistrationId: $id) { id key } }`, {
    id: registrationId,
  });
  const variableId = variables.data?.findApplicationRegistrationVariables.find(
    (variable) => variable.key === key,
  )?.id;

  if (!variableId) {
    throw new Error(`Server variable ${key} not found`);
  }

  const result = await metadata(
    `mutation($input: UpdateApplicationRegistrationVariableInput!) {
      updateApplicationRegistrationVariable(input: $input) { id } }`,
    { input: { id: variableId, update: value === null ? { resetValue: true } : { value } } },
  );

  if (result.errors?.length) {
    throw new Error(`Could not set ${key}: ${result.errors.map((error) => error.message).join('; ')}`);
  }
};

export const callAppRoute = async (method: 'GET' | 'POST', path: string, body?: unknown) => {
  const response = await fetch(`${apiUrl()}/s${path}`, {
    method,
    headers: authHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { status: response.status, body: await response.text() };
};
