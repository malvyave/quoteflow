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
};

const openQuoteTabEditing = async (page: Page) => {
  await openQuoteTab(page);
  await expect(page.getByRole('button', { name: 'Next: Review & share' })).toBeVisible();
};

const openQuoteTabOnReview = async (page: Page) => {
  await openQuoteTab(page);
  await expect(page.getByRole('button', { name: /2\s*Review & share/ })).toHaveAttribute(
    'aria-current',
    'step',
  );
};

test('a salesperson edits with a live preview, reviews and sends a quote', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });

  const dealId = await createDeal('editor flow');

  createdDeals.push(dealId);

  await signIn(page);
  await page.goto(`/object/opportunity/${dealId}`);
  await openQuoteTabEditing(page);

  // Step 1: edit, with the live preview beside the editor.
  await expect(page.getByRole('button', { name: /1\s*Edit/ })).toHaveAttribute('aria-current', 'step');
  await page.getByLabel('Line 1 description').fill('Smoke test item');
  await page.getByLabel('Line 1 quantity').fill('2');
  await page.getByLabel('Line 1 unit price').fill('125');
  await expect(page.getByText('$250.00').first()).toBeVisible();

  const preview = page.frameLocator('iframe[title="Quote preview"]');

  await expect(page.getByText('Live preview · what your client will see')).toBeVisible();
  await expect(preview.getByText('Smoke test item')).toBeVisible();
  await expect(preview.getByText('$250.00').first()).toBeVisible();

  // The preview follows edits without saving.
  await page.getByLabel('Line 1 unit price').fill('150');
  await expect(preview.getByText('$300.00').first()).toBeVisible();

  // Step 2: "Next" saves the new quote and moves on.
  await page.getByRole('button', { name: 'Next: Review & share' }).click();
  await expect(page.getByRole('button', { name: /2\s*Review & share/ })).toHaveAttribute(
    'aria-current',
    'step',
  );
  await expect(page.getByText('What your client will see')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send quote' })).toBeEnabled();

  await page.getByRole('button', { name: 'Send quote' }).click();
  await expect(page.getByRole('heading', { name: 'Send this quote?' })).toBeVisible();
  await page.getByRole('button', { name: 'Send quote' }).last().click();

  const clientLink = page.getByRole('textbox', { name: 'Client link' });

  await expect(clientLink).toBeVisible();
  await expect(page.getByText(/^Q-\d{4,}$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Withdraw and edit' })).toBeVisible();

  const clientUrl = await clientLink.inputValue();
  const clientPage = await context.browser()!.newPage();

  await clientPage.goto(clientUrl);
  await expect(clientPage.getByText('Smoke test item')).toBeVisible();
  await expect(clientPage.getByText('$300.00').first()).toBeVisible();
  await expect(clientPage.getByRole('button', { name: 'Accept quote' })).toBeVisible();
  await clientPage.close();

  // Reopening a sent quote lands on the review step.
  await page.reload();
  await openQuoteTabOnReview(page);
});

test('in a narrow panel the live preview opens on demand', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 });

  const dealId = await createDeal('editor narrow');

  createdDeals.push(dealId);

  await signIn(page);
  await page.goto(`/object/opportunity/${dealId}`);
  await openQuoteTabEditing(page);

  await page.getByLabel('Line 1 description').fill('Narrow item');
  await expect(page.locator('iframe[title="Quote preview"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Show live preview' }).click();
  await expect(
    page.frameLocator('iframe[title="Quote preview"]').getByText('Narrow item'),
  ).toBeVisible();
});
