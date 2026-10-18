import { describe, expect, it, vi } from 'vitest';

import { QuoteStatus } from 'src/objects/quote.object';
import {
  canSendAnotherQuote,
  countsAsActiveQuote,
  createStripeClient,
  FREE_ACTIVE_QUOTE_LIMIT,
  StripeError,
  toStripeFormBody,
} from 'src/utils/billing';

const WORKSPACE_ID = '20202020-1c25-4d02-bf25-6aeccf7ea419';
const now = new Date('2026-10-18T12:00:00.000Z');

describe('countsAsActiveQuote', () => {
  it('counts sent quotes that have not expired', () => {
    expect(countsAsActiveQuote({ status: QuoteStatus.SENT, expiresAt: null }, now)).toBe(true);
    expect(countsAsActiveQuote({ status: QuoteStatus.SENT, expiresAt: '2026-10-18' }, now)).toBe(
      true,
    );
  });

  it('ignores expired, draft, accepted and superseded quotes', () => {
    expect(countsAsActiveQuote({ status: QuoteStatus.SENT, expiresAt: '2026-10-17' }, now)).toBe(
      false,
    );

    for (const status of [QuoteStatus.DRAFT, QuoteStatus.ACCEPTED, QuoteStatus.SUPERSEDED]) {
      expect(countsAsActiveQuote({ status, expiresAt: null }, now)).toBe(false);
    }
  });
});

describe('canSendAnotherQuote', () => {
  const plan = {
    billingEnabled: true,
    isPaid: false,
    activeQuoteCount: 0,
    freeLimit: FREE_ACTIVE_QUOTE_LIMIT,
  };

  it('allows up to the free limit, then blocks', () => {
    expect(canSendAnotherQuote({ ...plan, activeQuoteCount: 4 })).toBe(true);
    expect(canSendAnotherQuote({ ...plan, activeQuoteCount: 5 })).toBe(false);
  });

  it('never blocks paid workspaces or installs without billing', () => {
    expect(canSendAnotherQuote({ ...plan, activeQuoteCount: 50, isPaid: true })).toBe(true);
    expect(canSendAnotherQuote({ ...plan, activeQuoteCount: 50, billingEnabled: false })).toBe(
      true,
    );
  });
});

describe('toStripeFormBody', () => {
  it('encodes nested objects and arrays the way Stripe expects', () => {
    const body = new URLSearchParams(
      toStripeFormBody({
        mode: 'subscription',
        line_items: [{ price: 'price_123', quantity: 1 }],
        metadata: { workspace_id: 'abc' },
        skipped: undefined,
      }),
    );

    expect(body.get('mode')).toBe('subscription');
    expect(body.get('line_items[0][price]')).toBe('price_123');
    expect(body.get('line_items[0][quantity]')).toBe('1');
    expect(body.get('metadata[workspace_id]')).toBe('abc');
    expect(body.has('skipped')).toBe(false);
  });
});

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

describe('createStripeClient', () => {
  it('finds an active subscription by workspace id', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { data: [{ id: 'sub_1', customer: 'cus_1' }] }),
    );
    const stripe = createStripeClient({ secretKey: 'sk_test_x', fetchImpl });

    await expect(stripe.findActiveSubscription(WORKSPACE_ID)).resolves.toEqual({
      subscriptionId: 'sub_1',
      customerId: 'cus_1',
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];

    expect(url).toContain('/v1/subscriptions/search?');
    expect(decodeURIComponent(url)).toContain(`metadata['workspace_id']:'${WORKSPACE_ID}'`);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test_x');
  });

  it('returns null when the workspace has no subscription', async () => {
    const stripe = createStripeClient({
      secretKey: 'sk_test_x',
      fetchImpl: async () => jsonResponse(200, { data: [] }),
    });

    await expect(stripe.findActiveSubscription(WORKSPACE_ID)).resolves.toBeNull();
  });

  it('refuses anything that is not a workspace id before calling Stripe', async () => {
    const fetchImpl = vi.fn();
    const stripe = createStripeClient({ secretKey: 'sk_test_x', fetchImpl });

    await expect(stripe.findActiveSubscription("x' OR status:'canceled")).rejects.toThrow(
      'Invalid workspace id',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('creates a subscription checkout tagged with the workspace', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { url: 'https://checkout.stripe.com/c/1' }));
    const stripe = createStripeClient({ secretKey: 'sk_test_x', fetchImpl });

    const url = await stripe.createCheckoutSession({
      priceId: 'price_123',
      workspaceId: WORKSPACE_ID,
      successUrl: 'https://app.test/s/billing/done',
      cancelUrl: 'https://app.test/s/billing/done',
    });
    const body = new URLSearchParams((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);

    expect(url).toBe('https://checkout.stripe.com/c/1');
    expect(body.get('mode')).toBe('subscription');
    expect(body.get('client_reference_id')).toBe(WORKSPACE_ID);
    expect(body.get('subscription_data[metadata][workspace_id]')).toBe(WORKSPACE_ID);
  });

  it('surfaces Stripe error messages', async () => {
    const stripe = createStripeClient({
      secretKey: 'sk_test_x',
      fetchImpl: async () => jsonResponse(400, { error: { message: 'No such price' } }),
    });

    const attempt = stripe.createCheckoutSession({
      priceId: 'price_missing',
      workspaceId: WORKSPACE_ID,
      successUrl: 'https://app.test',
      cancelUrl: 'https://app.test',
    });

    await expect(attempt).rejects.toBeInstanceOf(StripeError);
    await expect(attempt).rejects.toThrow('No such price');
  });
});
