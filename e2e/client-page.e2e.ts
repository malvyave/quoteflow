import { expect, test } from '@playwright/test';

import {
  createDeal,
  createQuote,
  destroyDeals,
  getDeal,
  isoDateFromToday,
  publicQuoteUrl,
  sendQuote,
} from 'src/__tests__/quote-flow-helpers';
import { majorToMicros } from 'src/utils/quote-totals';

// What a client sees: no Twenty account, just the link from the salesperson.

const createdDeals: string[] = [];

const sentQuoteUrl = async (dealName: string) => {
  const dealId = await createDeal(dealName);

  createdDeals.push(dealId);

  const quoteId = await createQuote(dealId, {
    name: 'Website Redesign quote',
    lines: [
      { name: 'Homepage redesign', quantity: 1, unitPrice: 4000 },
      { name: 'Mobile version', quantity: 1, unitPrice: 2500 },
    ],
    discountPercent: 10,
    taxPercent: 18,
    expiresAt: isoDateFromToday(30),
    message: 'Thanks for your time today.',
    terms: 'Payment due within 30 days.',
  });

  return { dealId, url: publicQuoteUrl(await sendQuote(quoteId)) };
};

test.afterAll(async () => {
  await destroyDeals(createdDeals);
});

test('a client reviews the quote, accepts it, and the deal is won', async ({ page }) => {
  const { dealId, url } = await sentQuoteUrl('browser accept');

  await page.goto(url);

  await expect(page.getByRole('heading', { name: 'Website Redesign quote' })).toBeVisible();
  await expect(page.getByText('Thanks for your time today.')).toBeVisible();
  await expect(page.getByText('$6,903.00')).toBeVisible();
  await expect(page.getByText('Payment due within 30 days.')).toBeVisible();

  await page.getByLabel('Your full name').fill('Samira Hadid');
  await page.getByRole('button', { name: 'Accept quote' }).click();

  await expect(page.getByText(/Accepted by Samira Hadid on .*Thank you!/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept quote' })).toHaveCount(0);

  const deal = await getDeal(dealId);

  expect(deal?.stage).toBe('CUSTOMER');
  expect(Number(deal?.amount.amountMicros)).toBe(majorToMicros(6903));
});

test('Download PDF opens the print dialog', async ({ page }) => {
  const { url } = await sentQuoteUrl('browser print button');

  await page.addInitScript(() => {
    (window as unknown as { printCalls: number }).printCalls = 0;
    window.print = () => {
      (window as unknown as { printCalls: number }).printCalls += 1;
    };
  });
  await page.goto(url);
  await page.getByRole('button', { name: 'Download PDF' }).click();

  expect(await page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(
    1,
  );
});

test('the printed quote hides buttons and keeps the content', async ({ page }) => {
  const { url } = await sentQuoteUrl('browser print layout');

  await page.goto(url);
  await page.emulateMedia({ media: 'print' });

  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Accept quote' })).toBeHidden();
  await expect(page.getByText('$6,903.00')).toBeVisible();
  await expect(page.getByText(/Prepared with QuoteFlow/)).toBeVisible();
});

test('the quote fits a phone screen without sideways scrolling', async ({ page }) => {
  const { url } = await sentQuoteUrl('browser phone');

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(url);
  await expect(page.getByText('$6,903.00')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  expect(overflow).toBeLessThanOrEqual(0);
});
