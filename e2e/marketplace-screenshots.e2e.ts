import { expect, test, type Page } from '@playwright/test';

import {
  createDeal,
  createQuote,
  destroyDeals,
  isoDateFromToday,
  publicQuoteUrl,
  sendQuote,
} from 'src/__tests__/quote-flow-helpers';

// Captures the marketplace gallery images (8:5, 1600×1000) from the design doc's example.
// Not a test: run it on purpose with
//   CAPTURE_SCREENSHOTS=1 yarn test:e2e e2e/marketplace-screenshots.e2e.ts
test.skip(!process.env.CAPTURE_SCREENSHOTS, 'Set CAPTURE_SCREENSHOTS=1 to capture screenshots.');

const SIZE = { width: 1600, height: 1000 };
const DEMO_MEMBER_EMAIL = 'tim@apple.dev';
const DEMO_MEMBER_PASSWORD = 'tim@apple.dev';

const createdDeals: string[] = [];

test.afterAll(async () => {
  await destroyDeals(createdDeals);
});

test.use({ colorScheme: 'light', viewport: SIZE, deviceScaleFactor: 1 });

const signIn = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('textbox').first().fill(DEMO_MEMBER_EMAIL);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('input[type="password"]').fill(DEMO_MEMBER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/welcome'));
};

test('capture the Quote tab and the client page', async ({ page, browser }) => {
  const dealId = await createDeal('Acme Corp – Website Redesign', 'PROPOSAL', {
    exactName: true,
    amount: 6500,
  });

  createdDeals.push(dealId);

  const quoteId = await createQuote(dealId, {
    name: 'Website Redesign',
    lines: [
      { name: 'Homepage redesign', quantity: 1, unitPrice: 4000 },
      { name: 'Mobile version', quantity: 1, unitPrice: 2500 },
    ],
    discountPercent: 10,
    taxPercent: 18,
    expiresAt: isoDateFromToday(30),
    message: 'Thanks for the call today! Here is the redesign we discussed, including the mobile version.',
    terms: 'Payment due within 30 days of acceptance. Two rounds of revisions included.',
  });

  await signIn(page);
  await page.goto(`/object/opportunity/${dealId}`);

  const quoteTab = page.getByText('Quote', { exact: true }).filter({ visible: true }).first();

  await quoteTab.click();
  await expect(page.getByText('Live preview · what your client will see')).toBeVisible();
  await expect(
    page.frameLocator('iframe[title="Quote preview"]').getByText('$6,903.00').first(),
  ).toBeVisible();
  await expect(page.getByText('$6,903.00').first()).toBeVisible();

  // The demo workspace shows a mail sync banner that has nothing to do with QuoteFlow.
  const banner = page.getByText(/Sync lost with mailbox/).filter({ visible: true });

  await page.waitForTimeout(2000);

  // Its close button has no label, so click the × at the right end of the banner's row.
  if (await banner.count()) {
    const box = await banner.first().boundingBox();

    if (box) {
      await page.mouse.click(SIZE.width - 20, box.y + box.height / 2);
      await expect(banner).toHaveCount(0);
    }
  }

  await page.screenshot({ path: 'public/screenshot-editor.png' });

  const token = await sendQuote(quoteId);
  const clientPage = await browser.newPage({ viewport: SIZE, colorScheme: 'light' });

  await clientPage.goto(publicQuoteUrl(token));
  await expect(clientPage.getByText('$6,903.00')).toBeVisible();
  await clientPage.screenshot({ path: 'public/screenshot-client.png' });
  await clientPage.close();
});
