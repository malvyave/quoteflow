import { expect, test, type Page } from '@playwright/test';

import {
  createDeal,
  createQuote,
  destroyDeals,
  gqlData,
  isoDateFromToday,
  metadata,
  publicQuoteUrl,
  sendQuote,
} from 'src/__tests__/quote-flow-helpers';

// Captures the marketplace gallery images (8:5, 1600×1000) from the design doc's example.
// Not a test: run it on purpose with
//   CAPTURE_SCREENSHOTS=1 yarn test:e2e e2e/marketplace-screenshots.e2e.ts
// Set the seller details to a fictional business first: the images are public, so they must not
// show real brands, logos or bank details.
test.skip(!process.env.CAPTURE_SCREENSHOTS, 'Set CAPTURE_SCREENSHOTS=1 to capture screenshots.');

const SIZE = { width: 1600, height: 1000 };
const DEMO_MEMBER_EMAIL = 'tim@apple.dev';
const DEMO_MEMBER_PASSWORD = 'tim@apple.dev';

// The dev image names its demo workspace after a real company; the gallery shows this instead.
const WORKSPACE_NAME_IN_IMAGES = 'Northwind Studio';

const createdDeals: string[] = [];
const createdRecords: { kind: 'Person' | 'Company'; id: string }[] = [];

test.afterAll(async () => {
  await destroyDeals(createdDeals);

  // People first: they point at the company.
  for (const { kind, id } of createdRecords.reverse()) {
    await gqlData(`mutation($id: UUID!) { destroy${kind}(id: $id) { id } }`, { id });
  }
});

// A fictional client, so the quote's "Quote to" block is filled in.
const createClient = async (opportunityId: string) => {
  const { createCompany } = await gqlData<{ createCompany: { id: string } }>(
    `mutation($d: CompanyCreateInput!) { createCompany(data: $d) { id } }`,
    {
      d: {
        name: 'Globex Corp',
        address: { addressStreet1: '42 Harbour Road', addressCity: 'Riverton', addressCountry: 'United States' },
      },
    },
  );

  createdRecords.push({ kind: 'Company', id: createCompany.id });

  const { createPerson } = await gqlData<{ createPerson: { id: string } }>(
    `mutation($d: PersonCreateInput!) { createPerson(data: $d) { id } }`,
    {
      d: {
        name: { firstName: 'Theodore', lastName: 'Gonzalez' },
        emails: { primaryEmail: 'theodore@globex.example' },
        companyId: createCompany.id,
      },
    },
  );

  createdRecords.push({ kind: 'Person', id: createPerson.id });

  await gqlData(`mutation($id: UUID!, $d: OpportunityUpdateInput!) { updateOpportunity(id: $id, data: $d) { id } }`, {
    id: opportunityId,
    d: { companyId: createCompany.id, pointOfContactId: createPerson.id },
  });
};

// Only changes the captured image, not the workspace.
const renameWorkspaceInPage = (page: Page, from: string) =>
  page.evaluate(
    ({ from, to }) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.textContent?.trim() === from) {
          node.textContent = to;
        }
      }
    },
    { from, to: WORKSPACE_NAME_IN_IMAGES },
  );

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
  const dealId = await createDeal('Globex Corp – Website Redesign', 'PROPOSAL', {
    exactName: true,
    amount: 6500,
  });

  createdDeals.push(dealId);
  await createClient(dealId);

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

  const workspace = await metadata<{ currentWorkspace: { displayName: string } }>(
    '{ currentWorkspace { displayName } }',
  );

  await renameWorkspaceInPage(page, workspace.data?.currentWorkspace.displayName ?? 'Apple');
  await page.screenshot({ path: 'public/screenshot-editor.png' });

  const token = await sendQuote(quoteId);
  const clientPage = await browser.newPage({ viewport: SIZE, colorScheme: 'light' });

  await clientPage.goto(publicQuoteUrl(token));
  await expect(clientPage.getByText('$6,903.00')).toBeVisible();
  await clientPage.screenshot({ path: 'public/screenshot-client.png' });
  await clientPage.close();
});
