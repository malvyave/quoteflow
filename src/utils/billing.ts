import { QuoteStatus } from 'src/objects/quote.object';
import { isQuoteExpired } from 'src/utils/quote-details';

// Pure billing rules and a minimal Stripe client. Nothing here reads the environment, so it can
// be unit-tested with a fake fetch.

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

// Stripe expects application/x-www-form-urlencoded bodies with bracketed keys for nesting.
export const toStripeFormBody = (params: Record<string, unknown>) => {
  const body = new URLSearchParams();

  const append = (key: string, value: unknown) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => append(`${key}[${index}]`, item));
    } else if (typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) =>
        append(`${key}[${childKey}]`, childValue),
      );
    } else {
      body.append(key, String(value));
    }
  };

  Object.entries(params).forEach(([key, value]) => append(key, value));

  return body.toString();
};

// Workspace ids are UUIDs; anything else must never reach a Stripe search query.
const assertWorkspaceId = (workspaceId: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) {
    throw new Error('Invalid workspace id.');
  }
};

const STRIPE_API_URL = 'https://api.stripe.com/v1';

type Fetch = typeof fetch;

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const createStripeClient = ({
  secretKey,
  fetchImpl = fetch,
}: {
  secretKey: string;
  fetchImpl?: Fetch;
}) => {
  const request = async <T>(method: 'GET' | 'POST', path: string, params?: Record<string, unknown>) => {
    const query = method === 'GET' && params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    const response = await fetchImpl(`${STRIPE_API_URL}${path}${query}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: method === 'POST' && params ? toStripeFormBody(params) : undefined,
    });
    const payload = (await response.json()) as T & { error?: { message?: string } };

    if (!response.ok) {
      throw new StripeError(payload.error?.message ?? `Stripe returned ${response.status}`, response.status);
    }

    return payload;
  };

  return {
    // Subscriptions carry the workspace id in their metadata, set at checkout.
    findActiveSubscription: async (workspaceId: string) => {
      assertWorkspaceId(workspaceId);

      const result = await request<{ data: { id: string; customer: string }[] }>(
        'GET',
        '/subscriptions/search',
        {
          query: `metadata['workspace_id']:'${workspaceId}' AND (status:'active' OR status:'trialing')`,
          limit: '1',
        },
      );
      const subscription = result.data[0];

      return subscription ? { subscriptionId: subscription.id, customerId: subscription.customer } : null;
    },

    createCheckoutSession: async ({
      priceId,
      workspaceId,
      successUrl,
      cancelUrl,
    }: {
      priceId: string;
      workspaceId: string;
      successUrl: string;
      cancelUrl: string;
    }) => {
      assertWorkspaceId(workspaceId);

      const session = await request<{ url: string }>('POST', '/checkout/sessions', {
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: workspaceId,
        metadata: { workspace_id: workspaceId },
        subscription_data: { metadata: { workspace_id: workspaceId } },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      return session.url;
    },

    createPortalSession: async ({ customerId, returnUrl }: { customerId: string; returnUrl: string }) => {
      const session = await request<{ url: string }>('POST', '/billing_portal/sessions', {
        customer: customerId,
        return_url: returnUrl,
      });

      return session.url;
    },
  };
};

export type StripeClient = ReturnType<typeof createStripeClient>;
