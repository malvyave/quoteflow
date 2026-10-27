// Pure billing rules and a minimal Dodo Payments client. Nothing here reads the environment, so
// it can be unit-tested with a fake fetch.

// The trial and the plans. Prices are shown in the app; they must match the Dodo Payments
// products and the website.
export const TRIAL_DAYS = 14;
export const TRIAL_QUOTE_LIMIT = 10;
export const LIFETIME_SEAT_LIMIT = 75;

export type Plan = 'monthly' | 'annual' | 'lifetime';

export const PLANS: Record<Plan, { label: string; price: string; detail: string }> = {
  monthly: { label: 'Monthly', price: '$12 / month', detail: 'Billed monthly. Cancel anytime.' },
  annual: { label: 'Annual', price: '$108 / year', detail: '$9 a month, billed yearly. Save 25%.' },
  lifetime: { label: 'Lifetime', price: '$139 once', detail: 'Pay once. Unlimited quotes, forever.' },
};

export const isPlan = (value: unknown): value is Plan =>
  value === 'monthly' || value === 'annual' || value === 'lifetime';

export type TrialStatus = {
  endsAt: string;
  daysLeft: number;
  quotesUsed: number;
  quoteLimit: number;
  isOver: boolean;
};

export type PlanStatus = {
  billingEnabled: boolean;
  isPaid: boolean;
  plan: Plan | null;
  trial: TrialStatus | null;
  isLifetimeAvailable: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// The trial runs 14 days from the workspace's first use, and covers 10 sent quotes; it ends at
// whichever comes first.
export const getTrialStatus = ({
  startedAt,
  quotesUsed,
  now,
}: {
  startedAt: string;
  quotesUsed: number;
  now: Date;
}): TrialStatus => {
  const endsAt = new Date(new Date(startedAt).getTime() + TRIAL_DAYS * DAY_MS);
  const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS));

  return {
    endsAt: endsAt.toISOString(),
    daysLeft,
    quotesUsed,
    quoteLimit: TRIAL_QUOTE_LIMIT,
    isOver: daysLeft === 0 || quotesUsed >= TRIAL_QUOTE_LIMIT,
  };
};

export const canSendAnotherQuote = ({ billingEnabled, isPaid, trial }: PlanStatus) =>
  !billingEnabled || isPaid || !trial?.isOver;

// What the member is told when sending is blocked.
export const trialOverMessage = (trial: TrialStatus | null) =>
  trial && trial.quotesUsed >= trial.quoteLimit && trial.daysLeft > 0
    ? `Your free trial includes ${trial.quoteLimit} quotes. Choose a plan to keep sending quotes.`
    : 'Your free trial has ended. Choose a plan to keep sending quotes.';

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
type DodoPayment = { payment_id: string; status?: string | null; refund_status?: string | null };

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
    let payload: T & { message?: string; error?: string };

    // An outage or a proxy can answer with an HTML page instead of JSON.
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new DodoError(`Dodo Payments returned an unreadable response (${response.status}).`, response.status);
    }

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

    // The product of the customer's paying subscription among the given ones, if any.
    findPayingSubscriptionProduct: async ({
      customerId,
      productIds,
    }: {
      customerId: string;
      productIds: string[];
    }) => {
      const { items } = await request<{ items: DodoSubscription[] }>('GET', '/subscriptions', {
        query: { customer_id: customerId, page_size: String(PAGE_SIZE) },
      });
      const paying = items.find(
        (subscription) =>
          isPayingSubscriptionStatus(subscription.status) &&
          subscription.product_id !== undefined &&
          productIds.includes(subscription.product_id),
      );

      return paying?.product_id ?? null;
    },

    // One-time purchases (Lifetime). A refunded payment no longer counts.
    countSucceededPayments: async ({
      productId,
      customerId,
      cap,
    }: {
      productId: string;
      customerId?: string;
      cap: number;
    }) => {
      let count = 0;

      for (let page = 0; page < MAX_CUSTOMER_PAGES && count < cap; page++) {
        const { items } = await request<{ items: DodoPayment[] }>('GET', '/payments', {
          query: {
            product_id: productId,
            status: 'succeeded',
            page_size: String(PAGE_SIZE),
            page_number: String(page),
            ...(customerId ? { customer_id: customerId } : {}),
          },
        });

        count += items.filter((payment) => !payment.refund_status).length;

        if (items.length < PAGE_SIZE) {
          break;
        }
      }

      return Math.min(count, cap);
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
