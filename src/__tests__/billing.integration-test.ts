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

// The free plan limit against a real server. These tests overwrite and then clear the billing
// server variables, so they run on CI's throwaway server, and locally only with
// TWENTY_TEST_BILLING=1, never by accident on a server where you entered your own keys.
// The Dodo test-mode block also needs DODO_TEST_API_KEY and DODO_TEST_PRODUCT_ID.

const changesServerVariables =
  process.env.CI === 'true' || process.env.TWENTY_TEST_BILLING === '1';

const createdDeals: string[] = [];

afterEach(async () => {
  if (!changesServerVariables) {
    return;
  }

  await setServerVariable('DODO_API_KEY', null);
  await setServerVariable('DODO_PRODUCT_ID', null);
  await setServerVariable('DODO_MODE', null);
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

describe.skipIf(!changesServerVariables)('without billing keys', () => {
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

// A workspace that never upgraded has no Dodo customer, so it is on the free plan without any
// call to Dodo. (Failing open when Dodo is down is covered by billing-server.test.ts.)
describe.skipIf(!changesServerVariables)('with billing on and no subscription yet', () => {
  it('enforces the free limit, and reports an error when Dodo rejects the upgrade', async () => {
    const { dealId } = await sendQuotesUntilActive(FREE_ACTIVE_QUOTE_LIMIT);

    await setServerVariable('DODO_API_KEY', 'not-a-real-dodo-key');
    await setServerVariable('DODO_PRODUCT_ID', 'pdt_not_real');

    const plan = await getPlan();
    const blocked = await callQuoteAction('send', { quoteId: await createQuote(dealId) });

    expect(plan.billingEnabled).toBe(true);
    expect(plan.isPaid).toBe(false);
    expect(blocked.status).toBe(402);
    expect(blocked.body).toContain(`${FREE_ACTIVE_QUOTE_LIMIT} active quotes`);
    expect((await callAppRoute('POST', '/quote-actions/upgrade')).status).toBe(502);
  });
});

const dodoTestKey = process.env.DODO_TEST_API_KEY;
const dodoTestProduct = process.env.DODO_TEST_PRODUCT_ID;

describe.skipIf(!changesServerVariables || !dodoTestKey || !dodoTestProduct)('with Dodo Payments in test mode', () => {
  it('blocks the quote over the free limit and offers a checkout', async () => {
    await setServerVariable('DODO_API_KEY', dodoTestKey as string);
    await setServerVariable('DODO_PRODUCT_ID', dodoTestProduct as string);
    await setServerVariable('DODO_MODE', 'test');

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
      url: expect.stringMatching(/^https:\/\/[^/]*dodopayments\.com\//),
    });
  });
});
