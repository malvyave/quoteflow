import { describe, expect, it } from 'vitest';

import { createDodoClient, type Plan } from 'src/utils/billing';

// The real Dodo Payments API in test mode, through the same client the app uses, so a wrong
// product ID or a change on Dodo's side fails here before a customer sees it. Runs only when
// the test-mode key and product IDs are set (GitHub secrets on CI). Each run adds one test
// customer to the Dodo test business; nothing is charged.

const apiKey = process.env.DODO_TEST_API_KEY;
const productIds: Record<Plan, string | undefined> = {
  monthly: process.env.DODO_TEST_MONTHLY_PRODUCT_ID,
  annual: process.env.DODO_TEST_ANNUAL_PRODUCT_ID,
  lifetime: process.env.DODO_TEST_LIFETIME_PRODUCT_ID,
};

const isConfigured = Boolean(apiKey) && Object.values(productIds).every(Boolean);
const RETURN_URL = 'https://example.com/s/billing/done';
const DODO_LINK = /^https:\/\/[^/]*dodopayments\.com\//;

describe.skipIf(!isConfigured)('Dodo Payments in test mode', () => {
  const dodo = createDodoClient({ apiKey: apiKey as string, mode: 'test' });
  const workspaceId = crypto.randomUUID();

  it('creates a customer, checkouts for all three plans and a portal link', async () => {
    const customerId = await dodo.createCustomer({
      name: 'QuoteFlowin CI',
      email: `ci+${workspaceId}@example.com`,
      workspaceId,
    });

    expect(customerId).toMatch(/^cus_/);

    for (const plan of ['monthly', 'annual', 'lifetime'] as const) {
      const url = await dodo.createCheckout({
        productId: productIds[plan] as string,
        customerId,
        workspaceId,
        returnUrl: RETURN_URL,
      });

      expect(url, plan).toMatch(DODO_LINK);
    }

    expect(await dodo.createPortalSession({ customerId, returnUrl: RETURN_URL })).toMatch(DODO_LINK);

    // A customer who only opened checkouts has paid for nothing.
    expect(
      await dodo.findPayingSubscriptionProduct({
        customerId,
        productIds: [productIds.monthly as string, productIds.annual as string],
      }),
    ).toBeNull();
    expect(
      await dodo.countSucceededPayments({ productId: productIds.lifetime as string, customerId, cap: 75 }),
    ).toBe(0);
  });

  it('reads the Lifetime sales count across all customers', async () => {
    const sold = await dodo.countSucceededPayments({ productId: productIds.lifetime as string, cap: 75 });

    expect(sold).toBeGreaterThanOrEqual(0);
    expect(sold).toBeLessThanOrEqual(75);
  });
});
