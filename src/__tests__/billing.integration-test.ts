import { afterAll, afterEach, describe, expect, it } from 'vitest';

import {
  callAppRoute,
  callQuoteAction,
  createDeal,
  createQuote,
  destroyDeals,
  setServerVariable,
} from 'src/__tests__/quote-flow-helpers';
import { TRIAL_QUOTE_LIMIT, type PlanStatus } from 'src/utils/billing';

// The free trial and the plans against a real server. These tests overwrite and then clear the
// billing server variables, so they run on CI's throwaway server, and locally only with
// TWENTY_TEST_BILLING=1, never by accident on a server where you entered your own keys.
// The real Dodo test-mode API is covered by src/utils/dodo-test-mode.test.ts: a checkout from
// here needs a signed-in member, which an API key is not.

const changesServerVariables =
  process.env.CI === 'true' || process.env.TWENTY_TEST_BILLING === '1';

const BILLING_VARIABLES = [
  'DODO_API_KEY',
  'DODO_MONTHLY_PRODUCT_ID',
  'DODO_ANNUAL_PRODUCT_ID',
  'DODO_LIFETIME_PRODUCT_ID',
  'DODO_MODE',
];

const createdDeals: string[] = [];

afterEach(async () => {
  if (!changesServerVariables) {
    return;
  }

  for (const key of BILLING_VARIABLES) {
    await setServerVariable(key, null);
  }
});

afterAll(async () => {
  await destroyDeals(createdDeals);
});

const getPlan = async () => {
  const { status, body } = await callAppRoute('GET', '/quote-actions/plan');

  expect(status).toBe(200);

  return JSON.parse(body) as PlanStatus;
};

const upgrade = (plan?: string) => callAppRoute('POST', '/quote-actions/upgrade', plan ? { plan } : {});

const useFakeBillingKeys = async () => {
  await setServerVariable('DODO_API_KEY', 'not-a-real-dodo-key');
  await setServerVariable('DODO_MONTHLY_PRODUCT_ID', 'pdt_monthly_not_real');
  await setServerVariable('DODO_ANNUAL_PRODUCT_ID', 'pdt_annual_not_real');
  await setServerVariable('DODO_LIFETIME_PRODUCT_ID', 'pdt_lifetime_not_real');
};

// Sends quotes until the trial's quote allowance is used up. Other tests and demo data may
// already have sent some.
const useUpTrialQuotes = async () => {
  const dealId = await createDeal('billing');

  createdDeals.push(dealId);

  let plan = await getPlan();

  while ((plan.trial?.quotesUsed ?? 0) < TRIAL_QUOTE_LIMIT) {
    const sent = await callQuoteAction('send', { quoteId: await createQuote(dealId) });

    expect(sent.status).toBe(200);
    plan = await getPlan();
  }

  return { dealId, plan };
};

describe.skipIf(!changesServerVariables)('without billing keys', () => {
  it('reports billing as off, with no trial and no limit', async () => {
    const plan = await getPlan();

    expect(plan).toMatchObject({ billingEnabled: false, isPaid: true, trial: null });
  });

  it('explains that billing is not set up when asked to upgrade', async () => {
    expect((await upgrade('monthly')).status).toBe(409);
  });
});

// A workspace that never upgraded has no Dodo customer, so its plan needs no call to Dodo.
// (Failing open when Dodo is down is covered by billing-server.test.ts.)
describe.skipIf(!changesServerVariables)('with billing on and no plan yet', () => {
  it('runs a 14-day, 10-quote trial and then blocks sending', async () => {
    await useFakeBillingKeys();

    const started = await getPlan();

    expect(started.billingEnabled).toBe(true);
    expect(started.isPaid).toBe(false);
    expect(started.trial).toMatchObject({ quoteLimit: TRIAL_QUOTE_LIMIT, daysLeft: 14 });

    const { dealId, plan } = await useUpTrialQuotes();

    expect(plan.trial?.isOver).toBe(true);

    const blocked = await callQuoteAction('send', { quoteId: await createQuote(dealId) });

    expect(blocked.status).toBe(402);
    expect(blocked.body).toContain(`includes ${TRIAL_QUOTE_LIMIT} quotes`);
  });

  it('only accepts the three plans, and reports an error when Dodo rejects the upgrade', async () => {
    await useFakeBillingKeys();

    expect((await upgrade('free')).status).toBe(400);
    expect((await upgrade('monthly')).status).toBe(502);
  });
});
