import { QuoteStatus } from 'src/objects/quote.object';
import { isQuoteExpired } from 'src/utils/quote-details';

// Pure billing rules and a minimal Dodo Payments client. Nothing here reads the environment, so
// it can be unit-tested with a fake fetch.

export const FREE_ACTIVE_QUOTE_LIMIT = 5;

export type PlanStatus = {
  billingEnabled: boolean;
  isPaid: boolean;
  activeQuoteCount: number;
  freeLimit: number;
};

// An active quote is one a client can still accept: sent and not past its valid-until date.
export const countsAsActiveQuote = (
  quote: { status: string | null; expiresAt: string | null },
  now: Date,
) => quote.status === QuoteStatus.SENT && !isQuoteExpired(quote.expiresAt, now);

export const canSendAnotherQuote = ({
  billingEnabled,
  isPaid,
  activeQuoteCount,
  freeLimit,
}: PlanStatus) => !billingEnabled || isPaid || activeQuoteCount < freeLimit;

// Subscriptions that still grant the paid plan. past_due keeps access while Dodo retries a
// failed renewal; on_hold, cancelled, expired and failed do not.
const PAYING_SUBSCRIPTION_STATUSES = new Set(['active', 'past_due']);

export const isPayingSubscriptionStatus = (status: string) => PAYING_SUBSCRIPTION_STATUSES.has(status);

export type DodoMode = 'test' | 'live';

export const DODO_API_URLS: Record<DodoMode, string> = {
  test: 'https://test.dodopayments.com',
  live: 'https://live.dodopayments.com',
};

export const toDodoMode = (value: string | undefined): DodoMode =>
  value?.trim().toLowerCase() === 'live' ? 'live' : 'test';

const PAGE_SIZE = 100;
// Bounds the fallback scan for a workspace's customer (100 per page).
const MAX_CUSTOMER_PAGES = 50;

type Fetch = typeof fetch;

export class DodoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type DodoCustomer = { customer_id: string; metadata?: Record<string, unknown> | null };
type DodoSubscription = { subscription_id: string; status: string; product_id?: string };

export const createDodoClient = ({
  apiKey,
  mode,
  fetchImpl = fetch,
}: {
  apiKey: string;
  mode: DodoMode;
  fetchImpl?: Fetch;
}) => {
  const request = async <T>(
    method: 'GET' | 'POST',
    path: string,
    { query, body }: { query?: Record<string, string>; body?: unknown } = {},
  ) => {
    const search = query ? `?${new URLSearchParams(query)}` : '';
    const response = await fetchImpl(`${DODO_API_URLS[mode]}${path}${search}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const payload = (text ? JSON.parse(text) : {}) as T & { message?: string; error?: string };

    if (!response.ok) {
      throw new DodoError(
        payload.message ?? payload.error ?? `Dodo Payments returned ${response.status}`,
        response.status,
      );
    }

    return payload;
  };

  return {
    // The workspace id goes in the customer's metadata, so a lost link can be recovered.
    createCustomer: async ({
      name,
      email,
      workspaceId,
    }: {
      name: string;
      email: string;
      workspaceId: string;
    }) => {
      const customer = await request<DodoCustomer>('POST', '/customers', {
        body: { name, email, metadata: { workspace_id: workspaceId } },
      });

      return customer.customer_id;
    },

    // The customer list cannot filter by metadata, so this pages through it. Only used when the
    // stored link is missing.
    findCustomerIdByWorkspace: async (workspaceId: string) => {
      for (let page = 0; page < MAX_CUSTOMER_PAGES; page++) {
        const { items } = await request<{ items: DodoCustomer[] }>('GET', '/customers', {
          query: { page_size: String(PAGE_SIZE), page_number: String(page) },
        });
        const match = items.find((customer) => customer.metadata?.workspace_id === workspaceId);

        if (match) {
          return match.customer_id;
        }

        if (items.length < PAGE_SIZE) {
          return null;
        }
      }

      return null;
    },

    hasPayingSubscription: async ({
      customerId,
      productId,
    }: {
      customerId: string;
      productId?: string;
    }) => {
      const { items } = await request<{ items: DodoSubscription[] }>('GET', '/subscriptions', {
        query: { customer_id: customerId, page_size: String(PAGE_SIZE) },
      });

      return items.some(
        (subscription) =>
          isPayingSubscriptionStatus(subscription.status) &&
          (!productId || !subscription.product_id || subscription.product_id === productId),
      );
    },

    createCheckout: async ({
      productId,
      customerId,
      workspaceId,
      returnUrl,
    }: {
      productId: string;
      customerId: string;
      workspaceId: string;
      returnUrl: string;
    }) => {
      const session = await request<{ checkout_url?: string | null }>('POST', '/checkouts', {
        body: {
          product_cart: [{ product_id: productId, quantity: 1 }],
          customer: { customer_id: customerId },
          metadata: { workspace_id: workspaceId },
          return_url: returnUrl,
        },
      });

      if (!session.checkout_url) {
        throw new DodoError('Dodo Payments did not return a checkout link.', 502);
      }

      return session.checkout_url;
    },

    createPortalSession: async ({ customerId, returnUrl }: { customerId: string; returnUrl: string }) => {
      const session = await request<{ link: string }>(
        'POST',
        `/customers/${encodeURIComponent(customerId)}/customer-portal/session`,
        { query: { return_url: returnUrl } },
      );

      return session.link;
    },
  };
};

export type DodoClient = ReturnType<typeof createDodoClient>;
