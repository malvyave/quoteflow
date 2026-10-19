import { describe, expect, it, vi } from 'vitest';

import { QuoteStatus } from 'src/objects/quote.object';
import {
  canSendAnotherQuote,
  countsAsActiveQuote,
  createDodoClient,
  DodoError,
  FREE_ACTIVE_QUOTE_LIMIT,
  isPayingSubscriptionStatus,
  toDodoMode,
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

describe('Dodo helpers', () => {
  it('only treats active and past-due subscriptions as paid', () => {
    expect(isPayingSubscriptionStatus('active')).toBe(true);
    expect(isPayingSubscriptionStatus('past_due')).toBe(true);

    for (const status of ['pending', 'on_hold', 'paused', 'cancelled', 'failed', 'expired']) {
      expect(isPayingSubscriptionStatus(status)).toBe(false);
    }
  });

  it('defaults to test mode unless live is set explicitly', () => {
    expect(toDodoMode(undefined)).toBe('test');
    expect(toDodoMode('')).toBe('test');
    expect(toDodoMode('LIVE ')).toBe('live');
    expect(toDodoMode('production')).toBe('test');
  });
});

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

type FetchCall = [string, RequestInit];

const recordingFetch = (responses: Response[]) => {
  const calls: FetchCall[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push([String(url), init ?? {}]);

    return responses.shift() ?? jsonResponse(500, { message: 'unexpected call' });
  });

  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
};

const bodyOf = (call: FetchCall) => JSON.parse(call[1].body as string);

describe('createDodoClient', () => {
  it('uses the test host by default and the live host only in live mode', async () => {
    const test = recordingFetch([jsonResponse(200, { items: [] })]);
    const live = recordingFetch([jsonResponse(200, { items: [] })]);

    await createDodoClient({ apiKey: 'k', mode: 'test', fetchImpl: test.fetchImpl }).hasPayingSubscription({
      customerId: 'cus_1',
    });
    await createDodoClient({ apiKey: 'k', mode: 'live', fetchImpl: live.fetchImpl }).hasPayingSubscription({
      customerId: 'cus_1',
    });

    expect(test.calls[0][0]).toMatch(/^https:\/\/test\.dodopayments\.com\/subscriptions\?/);
    expect(live.calls[0][0]).toMatch(/^https:\/\/live\.dodopayments\.com\/subscriptions\?/);
    expect((test.calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer k');
  });

  it('creates a customer tagged with the workspace id', async () => {
    const { calls, fetchImpl } = recordingFetch([jsonResponse(200, { customer_id: 'cus_new' })]);
    const dodo = createDodoClient({ apiKey: 'k', mode: 'test', fetchImpl });

    await expect(
      dodo.createCustomer({ name: 'Acme', email: 'owner@acme.test', workspaceId: WORKSPACE_ID }),
    ).resolves.toBe('cus_new');
    expect(calls[0][1].method).toBe('POST');
    expect(bodyOf(calls[0])).toEqual({
      name: 'Acme',
      email: 'owner@acme.test',
      metadata: { workspace_id: WORKSPACE_ID },
    });
  });

  it('finds a lost customer link by paging through customers', async () => {
    const page = (start: number, count: number) =>
      Array.from({ length: count }, (_, index) => ({
        customer_id: `cus_${start + index}`,
        metadata: { workspace_id: `other-${start + index}` },
      }));
    const { calls, fetchImpl } = recordingFetch([
      jsonResponse(200, { items: page(0, 100) }),
      jsonResponse(200, {
        items: [...page(100, 10), { customer_id: 'cus_ours', metadata: { workspace_id: WORKSPACE_ID } }],
      }),
    ]);
    const dodo = createDodoClient({ apiKey: 'k', mode: 'test', fetchImpl });

    await expect(dodo.findCustomerIdByWorkspace(WORKSPACE_ID)).resolves.toBe('cus_ours');
    expect(calls).toHaveLength(2);
    expect(calls[1][0]).toContain('page_number=1');
  });

  it('stops paging when the last page has no match', async () => {
    const { calls, fetchImpl } = recordingFetch([jsonResponse(200, { items: [] })]);
    const dodo = createDodoClient({ apiKey: 'k', mode: 'test', fetchImpl });

    await expect(dodo.findCustomerIdByWorkspace(WORKSPACE_ID)).resolves.toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('reports a paying subscription only for the configured product', async () => {
    const subscriptions = {
      items: [
        { subscription_id: 'sub_old', status: 'cancelled', product_id: 'pdt_quoteflow' },
        { subscription_id: 'sub_other', status: 'active', product_id: 'pdt_something_else' },
      ],
    };
    const dodo = (payload: unknown) =>
      createDodoClient({
        apiKey: 'k',
        mode: 'test',
        fetchImpl: recordingFetch([jsonResponse(200, payload)]).fetchImpl,
      });

    await expect(
      dodo(subscriptions).hasPayingSubscription({ customerId: 'cus_1', productId: 'pdt_quoteflow' }),
    ).resolves.toBe(false);
    await expect(
      dodo({
        items: [...subscriptions.items, { subscription_id: 'sub_1', status: 'active', product_id: 'pdt_quoteflow' }],
      }).hasPayingSubscription({ customerId: 'cus_1', productId: 'pdt_quoteflow' }),
    ).resolves.toBe(true);
  });

  it('creates a checkout for the existing customer, tagged with the workspace', async () => {
    const { calls, fetchImpl } = recordingFetch([
      jsonResponse(200, { session_id: 'cks_1', checkout_url: 'https://checkout.dodopayments.com/s/1' }),
    ]);
    const dodo = createDodoClient({ apiKey: 'k', mode: 'test', fetchImpl });

    await expect(
      dodo.createCheckout({
        productId: 'pdt_quoteflow',
        customerId: 'cus_1',
        workspaceId: WORKSPACE_ID,
        returnUrl: 'https://app.test/s/billing/done',
      }),
    ).resolves.toBe('https://checkout.dodopayments.com/s/1');
    expect(calls[0][0]).toBe('https://test.dodopayments.com/checkouts');
    expect(bodyOf(calls[0])).toEqual({
      product_cart: [{ product_id: 'pdt_quoteflow', quantity: 1 }],
      customer: { customer_id: 'cus_1' },
      metadata: { workspace_id: WORKSPACE_ID },
      return_url: 'https://app.test/s/billing/done',
    });
  });

  it('opens the customer portal for a customer', async () => {
    const { calls, fetchImpl } = recordingFetch([jsonResponse(200, { link: 'https://portal.test/1' })]);
    const dodo = createDodoClient({ apiKey: 'k', mode: 'test', fetchImpl });

    await expect(
      dodo.createPortalSession({ customerId: 'cus_1', returnUrl: 'https://app.test/back' }),
    ).resolves.toBe('https://portal.test/1');
    expect(calls[0][0]).toBe(
      'https://test.dodopayments.com/customers/cus_1/customer-portal/session?return_url=https%3A%2F%2Fapp.test%2Fback',
    );
  });

  it('surfaces Dodo error messages', async () => {
    const dodo = createDodoClient({
      apiKey: 'bad',
      mode: 'test',
      fetchImpl: recordingFetch([jsonResponse(401, { message: 'Invalid API key' })]).fetchImpl,
    });
    const attempt = dodo.hasPayingSubscription({ customerId: 'cus_1' });

    await expect(attempt).rejects.toBeInstanceOf(DodoError);
    await expect(attempt).rejects.toThrow('Invalid API key');
  });
});
