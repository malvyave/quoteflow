import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { kv } from 'twenty-sdk/logic-function';

import { QuoteStatus } from 'src/objects/quote.object';
import {
  countsAsActiveQuote,
  createDodoClient,
  FREE_ACTIVE_QUOTE_LIMIT,
  toDodoMode,
  type PlanStatus,
} from 'src/utils/billing';

// Billing as seen from a logic function. Dodo Payments keys are server variables set by the app
// owner; without an API key (self-hosted Twenty, local development) billing is off and there is
// no limit.
//
// Each workspace gets one Dodo customer, created at its first upgrade and tagged with the
// workspace id. The link is kept in the app key-value store; paid status is read from that
// customer's subscriptions.

const CUSTOMER_KEY = 'billing:customer';
const ENTITLEMENT_CACHE_KEY = 'billing:entitlement';
const PAID_CACHE_MS = 60 * 60 * 1000;
// Short, so a workspace that just paid is unblocked within a minute.
const UNPAID_CACHE_MS = 60 * 1000;
const ACTIVE_QUOTE_COUNT_CAP = 200;

type StoredCustomer = { customerId: string };
type CachedEntitlement = { isPaid: boolean; customerId: string | null; checkedAt: number };

export const getBillingConfig = () => {
  const apiKey = process.env.DODO_API_KEY?.trim() ?? '';

  return {
    enabled: apiKey !== '',
    apiKey,
    productId: process.env.DODO_PRODUCT_ID?.trim() ?? '',
    mode: toDodoMode(process.env.DODO_MODE),
  };
};

export const getDodo = () => {
  const { apiKey, mode } = getBillingConfig();

  return createDodoClient({ apiKey, mode });
};

export const getWorkspace = async () => {
  const { currentWorkspace } = await new MetadataApiClient().query({
    currentWorkspace: { id: true, displayName: true },
  });

  if (!currentWorkspace?.id) {
    throw new Error('Could not determine the workspace.');
  }

  return { id: currentWorkspace.id, name: currentWorkspace.displayName?.trim() || 'Twenty workspace' };
};

const getMemberEmail = async () => {
  const { currentUser } = await new MetadataApiClient().query({ currentUser: { email: true } });

  if (!currentUser?.email) {
    throw new Error('Could not determine your email address.');
  }

  return currentUser.email;
};

const getStoredCustomerId = async () => (await kv.get<StoredCustomer>(CUSTOMER_KEY))?.customerId ?? null;

const storeCustomerId = (customerId: string) => kv.set<StoredCustomer>(CUSTOMER_KEY, { customerId });

// Used on upgrade, before ever creating a customer: if the stored link was lost (for example
// after a reinstall), find the existing customer by its workspace tag so nobody pays twice.
export const getOrCreateCustomerId = async () => {
  const stored = await getStoredCustomerId();

  if (stored) {
    return stored;
  }

  const dodo = getDodo();
  const workspace = await getWorkspace();
  const recovered = await dodo.findCustomerIdByWorkspace(workspace.id);
  const customerId =
    recovered ??
    (await dodo.createCustomer({
      name: workspace.name,
      email: await getMemberEmail(),
      workspaceId: workspace.id,
    }));

  await storeCustomerId(customerId);

  return customerId;
};

// Fails open: if Dodo cannot be reached, the workspace is treated as paid so an outage never
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
    const customerId = await getStoredCustomerId();
    const isPaid = customerId
      ? await getDodo().hasPayingSubscription({
          customerId,
          productId: getBillingConfig().productId || undefined,
        })
      : false;
    const entitlement = { isPaid, customerId, checkedAt: Date.now() };

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
