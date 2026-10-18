import { expect, test, type Page } from '@playwright/test';

import { createDeal, destroyDeals } from 'src/__tests__/quote-flow-helpers';

// The Quote tab as a salesperson uses it, inside Twenty. Signs in as the seeded demo member of
// Twenty's dev image (see SETUP.md); these credentials only exist on that local test server.
const DEMO_MEMBER_EMAIL = 'tim@apple.dev';
const DEMO_MEMBER_PASSWORD = 'tim@apple.dev';

const createdDeals: string[] = [];

test.afterAll(async () => {
  await destroyDeals(createdDeals);
});

const signIn = async (page: Page) => {
  await page.goto('/');

  const emailInput = page.getByRole('textbox').first();

  await emailInput.fill(DEMO_MEMBER_EMAIL);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('input[type="password"]').fill(DEMO_MEMBER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/welcome'));
};

// The Quote tab sits in the "+N More" menu when the tab bar runs out of room. Twenty also keeps
// hidden copies of tab labels, so only visible matches count.
const openQuoteTab = async (page: Page) => {
  const visibleText = (text: string | RegExp) =>
    page.getByText(text, { exact: true }).filter({ visible: true });
  const quoteTab = visibleText('Quote').first();
  const moreMenu = visibleText(/^\+\d+ More$/).first();

  await expect(quoteTab.or(moreMenu).first()).toBeVisible();

  if (!(await quoteTab.isVisible())) {
    await moreMenu.click();
  }

  await visibleText('Quote').first().click();
  await expect(page.getByText('Preview as buyer')).toBeVisible();
};

test('a salesperson builds, previews and sends a quote from a deal', async ({ page, context }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });

  const dealId = await createDeal('editor flow');

  createdDeals.push(dealId);

  await signIn(page);
  await page.goto(`/object/opportunity/${dealId}`);
  await openQuoteTab(page);

  await page.getByLabel('Line 1 description').fill('Smoke test item');
  await page.getByLabel('Line 1 quantity').fill('2');
  await page.getByLabel('Line 1 unit price').fill('125');
  await expect(page.getByText('$250.00').first()).toBeVisible();

  await page.getByText('Preview as buyer').click();
  const preview = page.frameLocator('iframe[title="Quote preview"]');

  await expect(preview.getByText('Smoke test item')).toBeVisible();
  await expect(preview.getByText('Preview — this is what your client will see')).toBeVisible();
  await page.getByRole('button', { name: 'Back to editing' }).click();

  await page.getByRole('button', { name: 'Create quote' }).click();
  await expect(page.getByRole('button', { name: 'Send quote' })).toBeEnabled();

  await page.getByRole('button', { name: 'Send quote' }).click();
  await expect(page.getByRole('heading', { name: 'Send this quote?' })).toBeVisible();
  await page.getByRole('button', { name: 'Send quote' }).last().click();

  const clientLink = page.getByRole('textbox', { name: 'Client link' });

  await expect(clientLink).toBeVisible();
  await expect(page.getByText(/^Q-\d{4,}$/)).toBeVisible();

  const clientUrl = await clientLink.inputValue();
  const clientPage = await context.browser()!.newPage();

  await clientPage.goto(clientUrl);
  await expect(clientPage.getByText('Smoke test item')).toBeVisible();
  await expect(clientPage.getByRole('button', { name: 'Accept quote' })).toBeVisible();
  await clientPage.close();
});
