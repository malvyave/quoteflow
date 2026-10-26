import { describe, expect, it, vi } from 'vitest';

import {
  canSendAnotherQuote,
  createDodoClient,
  DodoError,
  getTrialStatus,
  isPayingSubscriptionStatus,
  isPlan,
  TRIAL_QUOTE_LIMIT,
  toDodoMode,
  trialOverMessage,
  type PlanStatus,
} from 'src/utils/billing';

const WORKSPACE_ID = '20202020-1c25-4d02-bf25-6aeccf7ea419';
const now = new Date('2026-10-18T12:00:00.000Z');

describe('getTrialStatus', () => {
  const startedAt = '2026-10-10T12:00:00.000Z';

  it('runs 14 days from the start, counting down whole days', () => {
    const trial = getTrialStatus({ startedAt, quotesUsed: 3, now });

    expect(trial.endsAt).toBe('2026-10-24T12:00:00.000Z');
    expect(trial.daysLeft).toBe(6);
    expect(trial.quotesUsed).toBe(3);
    expect(trial.quoteLimit).toBe(TRIAL_QUOTE_LIMIT);
    expect(trial.isOver).toBe(false);
  });

  it('ends after 14 days', () => {
    const trial = getTrialStatus({ startedAt, quotesUsed: 0, now: new Date('2026-10-24T12:00:01.000Z') });

    expect(trial.daysLeft).toBe(0);
    expect(trial.isOver).toBe(true);
  });

  it('ends once 10 quotes have been sent, even with days left', () => {
    expect(getTrialStatus({ startedAt, quotesUsed: 9, now }).isOver).toBe(false);
    expect(getTrialStatus({ startedAt, quotesUsed: 10, now }).isOver).toBe(true);
  });
});

describe('canSendAnotherQuote', () => {
  const status = (overrides: Partial<PlanStatus>): PlanStatus => ({
    billingEnabled: true,
    isPaid: false,
    plan: null,
    trial: getTrialStatus({ startedAt: '2026-10-10T12:00:00.000Z', quotesUsed: 0, now }),
    isLifetimeAvailable: true,
    ...overrides,
  });
  const over = getTrialStatus({ startedAt: '2026-10-10T12:00:00.000Z', quotesUsed: 10, now });

  it('allows sending during the trial and blocks it after', () => {
    expect(canSendAnotherQuote(status({}))).toBe(true);
    expect(canSendAnotherQuote(status({ trial: over }))).toBe(false);
  });

  it('never blocks a paid workspace or an install without billing', () => {
    expect(canSendAnotherQuote(status({ trial: over, isPaid: true, plan: 'annual' }))).toBe(true);
    expect(canSendAnotherQuote(status({ trial: over, billingEnabled: false }))).toBe(true);
  });
});

describe('trialOverMessage', () => {
  it('says which limit was reached', () => {
    expect(
      trialOverMessage(getTrialStatus({ startedAt: '2026-10-10T12:00:00.000Z', quotesUsed: 10, now })),
    ).toContain('includes 10 quotes');
    expect(
      trialOverMessage(getTrialStatus({ startedAt: '2026-09-01T12:00:00.000Z', quotesUsed: 2, now })),
    ).toBe('Your free trial has ended. Choose a plan to keep sending quotes.');
  });
});

describe('isPlan', () => {
  it('accepts only the three plans', () => {
    expect(['monthly', 'annual', 'lifetime'].every(isPlan)).toBe(true);
    expect(isPlan('free')).toBe(false);
    expect(isPlan(undefined)).toBe(false);
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

    await createDodoClient({ apiKey: 'k', mode: 'test', fetchImpl: test.fetchImpl }).findPayingSubscriptionProduct({
      customerId: 'cus_1',
      productIds: ['pdt_monthly'],
    });
    await createDodoClient({ apiKey: 'k', mode: 'live', fetchImpl: live.fetchImpl }).findPayingSubscriptionProduct({
      customerId: 'cus_1',
      productIds: ['pdt_monthly'],
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

  it('finds which of the plan products the customer pays for', async () => {
    const subscriptions = {
      items: [
        { subscription_id: 'sub_old', status: 'cancelled', product_id: 'pdt_monthly' },
        { subscription_id: 'sub_other', status: 'active', product_id: 'pdt_something_else' },
      ],
    };
    const dodo = (payload: unknown) =>
      createDodoClient({
        apiKey: 'k',
        mode: 'test',
        fetchImpl: recordingFetch([jsonResponse(200, payload)]).fetchImpl,
      });
    const productIds = ['pdt_monthly', 'pdt_annual'];

    await expect(
      dodo(subscriptions).findPayingSubscriptionProduct({ customerId: 'cus_1', productIds }),
    ).resolves.toBeNull();
    await expect(
      dodo({
        items: [...subscriptions.items, { subscription_id: 'sub_1', status: 'past_due', product_id: 'pdt_annual' }],
      }).findPayingSubscriptionProduct({ customerId: 'cus_1', productIds }),
    ).resolves.toBe('pdt_annual');
  });

  it('counts succeeded one-time payments for a product, leaving out refunds', async () => {
    const { calls, fetchImpl } = recordingFetch([
      jsonResponse(200, {
        items: [
          { payment_id: 'pay_1', status: 'succeeded', refund_status: null },
          { payment_id: 'pay_2', status: 'succeeded', refund_status: 'succeeded' },
          { payment_id: 'pay_3', status: 'succeeded' },
        ],
      }),
    ]);
    const dodo = createDodoClient({ apiKey: 'k', mode: 'test', fetchImpl });

    await expect(
      dodo.countSucceededPayments({ productId: 'pdt_lifetime', customerId: 'cus_1', cap: 75 }),
    ).resolves.toBe(2);
    expect(calls[0][0]).toContain('/payments?');
    expect(calls[0][0]).toContain('product_id=pdt_lifetime');
    expect(calls[0][0]).toContain('status=succeeded');
    expect(calls[0][0]).toContain('customer_id=cus_1');
  });

  it('pages through payments and stops at the cap', async () => {
    const page = Array.from({ length: 100 }, (_, index) => ({ payment_id: `pay_${index}`, status: 'succeeded' }));
    const { calls, fetchImpl } = recordingFetch([jsonResponse(200, { items: page }), jsonResponse(200, { items: page })]);
    const dodo = createDodoClient({ apiKey: 'k', mode: 'test', fetchImpl });

    await expect(dodo.countSucceededPayments({ productId: 'pdt_lifetime', cap: 75 })).resolves.toBe(75);
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).not.toContain('customer_id');
  });

  it('creates a checkout for the existing customer, tagged with the workspace', async () => {
    const { calls, fetchImpl } = recordingFetch([
      jsonResponse(200, { session_id: 'cks_1', checkout_url: 'https://checkout.dodopayments.com/s/1' }),
    ]);
    const dodo = createDodoClient({ apiKey: 'k', mode: 'test', fetchImpl });

    await expect(
      dodo.createCheckout({
        productId: 'pdt_monthly',
        customerId: 'cus_1',
        workspaceId: WORKSPACE_ID,
        returnUrl: 'https://app.test/s/billing/done',
      }),
    ).resolves.toBe('https://checkout.dodopayments.com/s/1');
    expect(calls[0][0]).toBe('https://test.dodopayments.com/checkouts');
    expect(bodyOf(calls[0])).toEqual({
      product_cart: [{ product_id: 'pdt_monthly', quantity: 1 }],
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
    const attempt = dodo.findPayingSubscriptionProduct({ customerId: 'cus_1', productIds: ['pdt_monthly'] });

    await expect(attempt).rejects.toBeInstanceOf(DodoError);
    await expect(attempt).rejects.toThrow('Invalid API key');
  });
});
