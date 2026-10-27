import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { kv } from 'twenty-sdk/logic-function';

import {
  createDodoClient,
  getTrialStatus,
  LIFETIME_SEAT_LIMIT,
  TRIAL_QUOTE_LIMIT,
  toDodoMode,
  type Plan,
  type PlanStatus,
} from 'src/utils/billing';

// Billing as seen from a logic function. Dodo Payments keys are server variables set by the app
// owner; without an API key (self-hosted Twenty, local development) billing is off and there is
// no limit.
//
// Each workspace gets one Dodo customer, created at its first upgrade and tagged with the
// workspace id. The link is kept in the app key-value store; the plan is read from that
// customer's subscriptions (Monthly, Annual) or one-time payments (Lifetime).

const CUSTOMER_KEY = 'billing:customer';
const ENTITLEMENT_CACHE_KEY = 'billing:entitlement';
const TRIAL_STARTED_KEY = 'billing:trial-started-at';
const LIFETIME_SOLD_KEY = 'billing:lifetime-sold';
const HIGHEST_NUMBER_KEY = 'billing:highest-quote-number';
const PAID_CACHE_MS = 60 * 60 * 1000;
// Short, so a workspace that just paid is unblocked within a minute.
const UNPAID_CACHE_MS = 60 * 1000;
const LIFETIME_SOLD_CACHE_MS = 60 * 60 * 1000;

type StoredCustomer = { customerId: string };
type CachedEntitlement = {
  isPaid: boolean;
  plan: Plan | null;
  customerId: string | null;
  checkedAt: number;
};

export const getBillingConfig = () => {
  const apiKey = process.env.DODO_API_KEY?.trim() ?? '';
  const productIds: Record<Plan, string> = {
    monthly: process.env.DODO_MONTHLY_PRODUCT_ID?.trim() ?? '',
    annual: process.env.DODO_ANNUAL_PRODUCT_ID?.trim() ?? '',
    lifetime: process.env.DODO_LIFETIME_PRODUCT_ID?.trim() ?? '',
  };

  return { enabled: apiKey !== '', apiKey, productIds, mode: toDodoMode(process.env.DODO_MODE) };
};

const planForProduct = (productId: string | null): Plan | null => {
  const { productIds } = getBillingConfig();

  return (Object.keys(productIds) as Plan[]).find((plan) => productIds[plan] === productId) ?? null;
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
    const plan = customerId ? await findCustomerPlan(customerId) : null;
    const entitlement = { isPaid: plan !== null, plan, customerId, checkedAt: Date.now() };

    await kv.set(ENTITLEMENT_CACHE_KEY, entitlement);

    return entitlement;
  } catch (error) {
    console.warn('Could not check the QuoteFlow plan; allowing this request.', error);

    return { isPaid: true, plan: null, customerId: null, checkedAt: Date.now() };
  }
};

const findCustomerPlan = async (customerId: string): Promise<Plan | null> => {
  const { productIds } = getBillingConfig();
  const dodo = getDodo();
  const subscriptionProducts = [productIds.monthly, productIds.annual].filter(Boolean);

  if (subscriptionProducts.length > 0) {
    const product = await dodo.findPayingSubscriptionProduct({ customerId, productIds: subscriptionProducts });

    if (product) {
      return planForProduct(product);
    }
  }

  if (productIds.lifetime) {
    const paid = await dodo.countSucceededPayments({ productId: productIds.lifetime, customerId, cap: 1 });

    if (paid > 0) {
      return 'lifetime';
    }
  }

  return null;
};

// Lifetime is limited to the first 75 workspaces across every install. The count is cached for an
// hour; if it cannot be read, Lifetime stays on offer rather than disappearing.
export const isLifetimeAvailable = async () => {
  const { productIds } = getBillingConfig();

  if (!productIds.lifetime) {
    return false;
  }

  const cached = await kv.get<{ sold: number; checkedAt: number }>(LIFETIME_SOLD_KEY);

  if (cached && Date.now() - cached.checkedAt < LIFETIME_SOLD_CACHE_MS) {
    return cached.sold < LIFETIME_SEAT_LIMIT;
  }

  try {
    const sold = await getDodo().countSucceededPayments({
      productId: productIds.lifetime,
      cap: LIFETIME_SEAT_LIMIT,
    });

    await kv.set(LIFETIME_SOLD_KEY, { sold, checkedAt: Date.now() });

    return sold < LIFETIME_SEAT_LIMIT;
  } catch (error) {
    console.warn('Could not count Lifetime sales.', error);

    return true;
  }
};

// The trial clock starts the first time the workspace uses QuoteFlow with billing on.
const getTrialStartedAt = async () => {
  const stored = await kv.get<string>(TRIAL_STARTED_KEY);

  if (stored) {
    return stored;
  }

  const now = new Date().toISOString();

  await kv.set(TRIAL_STARTED_KEY, now);

  return now;
};

// Quote numbers only go up, so the highest one handed out is how many quotes were ever sent,
// even after some are deleted. Called each time a quote gets its number.
// The quote is already sent by then, so a failure here is logged rather than reported.
export const recordQuoteNumber = async (number: number) => {
  try {
    const highest = (await kv.get<number>(HIGHEST_NUMBER_KEY)) ?? 0;

    if (number > highest) {
      await kv.set(HIGHEST_NUMBER_KEY, number);
    }
  } catch (error) {
    console.warn('Could not record the quote number for the trial count.', error);
  }
};

// Quotes ever sent in the workspace: every sent quote gets a number, and keeps it when withdrawn.
// The stored highest number covers quotes deleted since; the count covers quotes sent before it
// was stored. Runs as the app so every member's quotes count toward the trial.
export const countSentQuotes = async () => {
  const { quotes } = await new CoreApiClient({ runAs: 'application' }).query({
    quotes: {
      __args: { filter: { number: { is: 'NOT_NULL' } }, first: TRIAL_QUOTE_LIMIT + 1 },
      edges: { node: { id: true } },
    },
  });

  return Math.max(quotes?.edges.length ?? 0, (await kv.get<number>(HIGHEST_NUMBER_KEY)) ?? 0);
};

export const getPlanStatus = async (): Promise<PlanStatus> => {
  if (!getBillingConfig().enabled) {
    return { billingEnabled: false, isPaid: true, plan: null, trial: null, isLifetimeAvailable: false };
  }

  const entitlement = await getEntitlement();
  const trial = getTrialStatus({
    startedAt: await getTrialStartedAt(),
    quotesUsed: await countSentQuotes(),
    now: new Date(),
  });

  return {
    billingEnabled: true,
    isPaid: entitlement.isPaid,
    plan: entitlement.plan,
    trial,
    isLifetimeAvailable: entitlement.isPaid ? false : await isLifetimeAvailable(),
  };
};

export const functionsBaseUrl = () =>
  (process.env.TWENTY_FUNCTIONS_URL || `${process.env.TWENTY_API_URL}/s`).replace(/\/$/, '');
