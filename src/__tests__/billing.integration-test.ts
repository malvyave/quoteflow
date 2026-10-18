import { afterAll, afterEach, describe, expect, it } from 'vitest';

import {
  callAppRoute,
  callQuoteAction,
  createDeal,
  createQuote,
  destroyDeals,
  setServerVariable,
} from 'src/__tests__/quote-flow-helpers';
import { FREE_ACTIVE_QUOTE_LIMIT, type PlanStatus } from 'src/utils/billing';

// The free plan limit against a real server. The Stripe test-mode block runs only when
// STRIPE_TEST_SECRET_KEY and STRIPE_TEST_PRICE_ID are set (a Stripe account in test mode).

const createdDeals: string[] = [];

afterEach(async () => {
  await setServerVariable('STRIPE_SECRET_KEY', null);
  await setServerVariable('STRIPE_PRICE_ID', null);
});

afterAll(async () => {
  await destroyDeals(createdDeals);
});

const getPlan = async () => {
  const { status, body } = await callAppRoute('GET', '/quote-actions/plan');

  expect(status).toBe(200);

  return JSON.parse(body) as PlanStatus;
};

// Sends quotes until the workspace has at least `target` active ones. Other tests and demo
// data may already have some.
const sendQuotesUntilActive = async (target: number) => {
  const dealId = await createDeal('billing');

  createdDeals.push(dealId);

  const statuses: number[] = [];
  let plan = await getPlan();

  while (plan.activeQuoteCount < target) {
    const quoteId = await createQuote(dealId);

    statuses.push((await callQuoteAction('send', { quoteId })).status);
    plan = await getPlan();
  }

  return { dealId, statuses, plan };
};

describe('without Stripe keys', () => {
  it('reports billing as off and never limits sending', async () => {
    const { statuses, plan } = await sendQuotesUntilActive(FREE_ACTIVE_QUOTE_LIMIT + 1);

    expect(plan.billingEnabled).toBe(false);
    expect(plan.isPaid).toBe(true);
    expect(statuses.every((status) => status === 200)).toBe(true);
  });

  it('explains that billing is not set up when asked to upgrade', async () => {
    expect((await callAppRoute('POST', '/quote-actions/upgrade')).status).toBe(409);
  });
});

describe('when Stripe cannot be reached', () => {
  it('fails open: sending still works and the upgrade reports an error', async () => {
    await setServerVariable('STRIPE_SECRET_KEY', 'sk_test_not_a_real_key');
    await setServerVariable('STRIPE_PRICE_ID', 'price_not_real');

    const { dealId } = await sendQuotesUntilActive(FREE_ACTIVE_QUOTE_LIMIT);
    const extraQuote = await createQuote(dealId);
    const plan = await getPlan();

    expect(plan.billingEnabled).toBe(true);
    expect(plan.isPaid).toBe(true);
    expect((await callQuoteAction('send', { quoteId: extraQuote })).status).toBe(200);
    expect((await callAppRoute('POST', '/quote-actions/upgrade')).status).toBe(502);
  });
});

const stripeTestKey = process.env.STRIPE_TEST_SECRET_KEY;
const stripeTestPrice = process.env.STRIPE_TEST_PRICE_ID;

describe.skipIf(!stripeTestKey || !stripeTestPrice)('with Stripe in test mode', () => {
  it('blocks the quote over the free limit and offers a checkout', async () => {
    await setServerVariable('STRIPE_SECRET_KEY', stripeTestKey as string);
    await setServerVariable('STRIPE_PRICE_ID', stripeTestPrice as string);

    const { dealId } = await sendQuotesUntilActive(FREE_ACTIVE_QUOTE_LIMIT);
    const plan = await getPlan();

    expect(plan.billingEnabled).toBe(true);
    expect(plan.isPaid).toBe(false);

    const blocked = await callQuoteAction('send', { quoteId: await createQuote(dealId) });

    expect(blocked.status).toBe(402);
    expect(blocked.body).toContain(`${FREE_ACTIVE_QUOTE_LIMIT} active quotes`);

    const upgrade = await callAppRoute('POST', '/quote-actions/upgrade');

    expect(upgrade.status).toBe(200);
    expect(JSON.parse(upgrade.body)).toMatchObject({
      kind: 'checkout',
      url: expect.stringContaining('https://checkout.stripe.com/'),
    });
  });
});
