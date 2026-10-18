import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { kv } from 'twenty-sdk/logic-function';

import { QuoteStatus } from 'src/objects/quote.object';
import {
  countsAsActiveQuote,
  createStripeClient,
  FREE_ACTIVE_QUOTE_LIMIT,
  type PlanStatus,
} from 'src/utils/billing';

// Billing as seen from a logic function. Stripe keys are server variables set by the app owner;
// without them (self-hosted Twenty, local development) billing is off and there is no limit.

const ENTITLEMENT_CACHE_KEY = 'billing:entitlement';
const PAID_CACHE_MS = 60 * 60 * 1000;
// Short, so a workspace that just paid is unblocked within a minute.
const UNPAID_CACHE_MS = 60 * 1000;
const ACTIVE_QUOTE_COUNT_CAP = 200;

type CachedEntitlement = { isPaid: boolean; customerId: string | null; checkedAt: number };

export const getBillingConfig = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  const priceId = process.env.STRIPE_PRICE_ID?.trim() ?? '';

  return { enabled: secretKey !== '', secretKey, priceId };
};

export const getStripe = () => createStripeClient({ secretKey: getBillingConfig().secretKey });

export const getWorkspaceId = async () => {
  const { currentWorkspace } = await new MetadataApiClient().query({
    currentWorkspace: { id: true },
  });

  if (!currentWorkspace?.id) {
    throw new Error('Could not determine the workspace.');
  }

  return currentWorkspace.id;
};

// Fails open: if Stripe cannot be reached, the workspace is treated as paid so an outage never
// blocks customers. The miss is logged and the next run asks again.
export const getEntitlement = async ({ refresh = false } = {}): Promise<CachedEntitlement> => {
  const cached = refresh ? null : await kv.get<CachedEntitlement>(ENTITLEMENT_CACHE_KEY);

  if (cached) {
    const maxAge = cached.isPaid ? PAID_CACHE_MS : UNPAID_CACHE_MS;

    if (Date.now() - cached.checkedAt < maxAge) {
      return cached;
    }
  }

  try {
    const subscription = await getStripe().findActiveSubscription(await getWorkspaceId());
    const entitlement = {
      isPaid: subscription !== null,
      customerId: subscription?.customerId ?? null,
      checkedAt: Date.now(),
    };

    await kv.set(ENTITLEMENT_CACHE_KEY, entitlement);

    return entitlement;
  } catch (error) {
    console.warn('Could not check the QuoteFlow subscription; allowing this request.', error);

    return { isPaid: true, customerId: null, checkedAt: Date.now() };
  }
};

// Runs as the app so every member's quotes count toward the workspace limit.
export const countActiveQuotes = async () => {
  const { quotes } = await new CoreApiClient({ runAs: 'application' }).query({
    quotes: {
      __args: { filter: { status: { eq: QuoteStatus.SENT } }, first: ACTIVE_QUOTE_COUNT_CAP },
      edges: { node: { status: true, expiresAt: true } },
    },
  });
  const now = new Date();

  return (quotes?.edges ?? []).filter(({ node }) =>
    countsAsActiveQuote({ status: node.status ?? null, expiresAt: node.expiresAt ?? null }, now),
  ).length;
};

export const getPlanStatus = async (): Promise<PlanStatus> => {
  const { enabled } = getBillingConfig();
  const activeQuoteCount = await countActiveQuotes();

  return {
    billingEnabled: enabled,
    isPaid: enabled ? (await getEntitlement()).isPaid : true,
    activeQuoteCount,
    freeLimit: FREE_ACTIVE_QUOTE_LIMIT,
  };
};

export const functionsBaseUrl = () =>
  (process.env.TWENTY_FUNCTIONS_URL || `${process.env.TWENTY_API_URL}/s`).replace(/\/$/, '');
