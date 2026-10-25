import { afterAll, describe, expect, it } from 'vitest';

import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  DEFAULT_WON_STAGE,
} from 'src/constants/universal-identifiers';
import {
  acceptPublicQuote,
  callQuoteAction,
  createDeal,
  createQuote,
  destroyDeals,
  getDeal,
  getQuote,
  gql,
  isoDateFromToday,
  metadata,
  sendQuote,
  viewPublicQuote,
} from 'src/__tests__/quote-flow-helpers';
import { majorToMicros } from 'src/utils/quote-totals';

// End-to-end checks of the quote flow against a running Twenty server. Every test creates
// its own deals and quotes, and they are destroyed afterwards.

const createdDeals: string[] = [];

const newDeal = async (name: string, stage?: string) => {
  const id = await createDeal(name, stage);

  createdDeals.push(id);

  return id;
};

afterAll(async () => {
  await destroyDeals(createdDeals);
});

const DESIGN_DOC_EXAMPLE = {
  lines: [
    { name: 'Homepage redesign', quantity: 1, unitPrice: 4000 },
    { name: 'Mobile version', quantity: 1, unitPrice: 2500 },
  ],
  discountPercent: 10,
  taxPercent: 18,
};

describe('sending a quote', () => {
  it('locks the quote, numbers it and gives it a 256-bit public link', async () => {
    const dealId = await newDeal('send');
    const quoteId = await createQuote(dealId, { expiresAt: isoDateFromToday(30) });

    const token = await sendQuote(quoteId);
    const quote = await getQuote(quoteId);

    expect(quote.status).toBe('SENT');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(quote.number).toBeGreaterThan(0);
  });

  it('gives quotes sent at the same moment different numbers', async () => {
    const dealId = await newDeal('numbering race');
    const quoteIds = await Promise.all([
      createQuote(dealId, { name: 'Race A' }),
      createQuote(dealId, { name: 'Race B' }),
      createQuote(dealId, { name: 'Race C' }),
    ]);

    const results = await Promise.all(
      quoteIds.map((quoteId) => callQuoteAction('send', { quoteId })),
    );
    const numbers = await Promise.all(quoteIds.map(async (id) => (await getQuote(id)).number));

    // Bodies are included so a failure shows the server's error, not just the status.
    expect(results.map((result) => `${result.status} ${result.body.slice(0, 300)}`)).toEqual([
      '200 {"ok":true}',
      '200 {"ok":true}',
      '200 {"ok":true}',
    ]);
    expect(new Set(numbers).size).toBe(3);
  });

  it('keeps its number when withdrawn and sent again', async () => {
    const dealId = await newDeal('renumber');
    const quoteId = await createQuote(dealId);

    await sendQuote(quoteId);
    const { number } = await getQuote(quoteId);

    expect((await callQuoteAction('withdraw', { quoteId })).status).toBe(200);
    await sendQuote(quoteId);

    expect((await getQuote(quoteId)).number).toBe(number);
  });

  it('refuses invalid requests with clear statuses', async () => {
    const dealId = await newDeal('send errors');
    const emptyQuoteId = await createQuote(dealId, { lines: [] });
    const pastQuoteId = await createQuote(dealId, { expiresAt: isoDateFromToday(-1) });
    const sentQuoteId = await createQuote(dealId);

    await sendQuote(sentQuoteId);

    expect((await callQuoteAction('send', {})).status).toBe(400);
    expect((await callQuoteAction('send', { quoteId: 'not-a-uuid' })).status).toBe(400);
    expect(
      (await callQuoteAction('send', { quoteId: '00000000-0000-4000-8000-000000000000' })).status,
    ).toBe(404);
    expect((await callQuoteAction('send', { quoteId: emptyQuoteId })).status).toBe(422);
    expect((await callQuoteAction('send', { quoteId: pastQuoteId })).status).toBe(422);
    expect((await callQuoteAction('send', { quoteId: sentQuoteId })).status).toBe(409);
    expect((await callQuoteAction('withdraw', { quoteId: emptyQuoteId })).status).toBe(409);
  });

  it('requires a signed-in member', async () => {
    const dealId = await newDeal('send auth');
    const quoteId = await createQuote(dealId);

    const result = await callQuoteAction('send', { quoteId }, { authenticated: false });

    expect(result.status).toBe(403);
    expect((await getQuote(quoteId)).status).toBe('DRAFT');
  });
});

describe('locked fields', () => {
  it('cannot be changed through the API, even with full access', async () => {
    const dealId = await newDeal('locked fields');
    const quoteId = await createQuote(dealId);
    const update = (data: Record<string, unknown>) =>
      gql(`mutation($id: UUID!, $d: QuoteUpdateInput!) { updateQuote(id: $id, data: $d) { id } }`, {
        id: quoteId,
        d: data,
      });

    for (const data of [
      { status: 'ACCEPTED' },
      { publicToken: 'a'.repeat(64) },
      { number: 999999 },
      { acceptedAt: new Date().toISOString() },
    ]) {
      const result = await update(data);

      expect(result.errors?.[0]?.message).toMatch(/not writable/);
    }

    expect((await update({ name: 'Renamed' })).errors).toBeUndefined();
  });
});

describe('the public quote page', () => {
  it('shows the quote, totals, message and terms to a visitor with no account', async () => {
    const dealId = await newDeal('public page');
    const quoteId = await createQuote(dealId, {
      ...DESIGN_DOC_EXAMPLE,
      expiresAt: '2099-01-31',
      message: 'Thanks for your time!',
      terms: 'Net 30.',
    });
    const token = await sendQuote(quoteId);

    const { status, html } = await viewPublicQuote(token);

    expect(status).toBe(200);
    expect(html).toContain('Homepage redesign');
    expect(html).toContain('$6,903.00');
    expect(html).toContain('<span>Valid Until</span><span class="value">: January 31, 2099</span>');
    expect(html).toContain('Thanks for your time!');
    expect(html).toContain('Net 30.');
    expect(html).toContain('Accept quote');
    expect(html).toContain('noindex');
    expect(html).not.toContain('<script>');
  });

  it('opens the print dialog only when asked to', async () => {
    const dealId = await newDeal('print');
    const token = await sendQuote(await createQuote(dealId));

    expect((await viewPublicQuote(token, '?print=1')).html).toContain('window.print()');
    expect((await viewPublicQuote(token)).html).not.toContain("addEventListener('load'");
  });

  it('answers unknown, malformed and withdrawn links with not found', async () => {
    const dealId = await newDeal('not found');
    const quoteId = await createQuote(dealId);
    const token = await sendQuote(quoteId);

    await callQuoteAction('withdraw', { quoteId });

    expect((await viewPublicQuote(token)).status).toBe(404);
    expect((await viewPublicQuote('f'.repeat(64))).status).toBe(404);
    expect((await viewPublicQuote('not-a-token')).status).toBe(404);
    expect((await acceptPublicQuote(token)).status).toBe(404);
  });
});

describe('accepting a quote', () => {
  it('marks the quote accepted and the deal won at the quoted amount', async () => {
    const dealId = await newDeal('accept');
    const token = await sendQuote(await createQuote(dealId, DESIGN_DOC_EXAMPLE));

    const { status, html } = await acceptPublicQuote(token);
    const deal = await getDeal(dealId);

    expect(status).toBe(200);
    expect(html).toContain('Accepted on');
    expect(deal?.stage).toBe(DEFAULT_WON_STAGE);
    expect(Number(deal?.amount.amountMicros)).toBe(majorToMicros(6903));
  });

  it('is harmless to submit twice', async () => {
    const dealId = await newDeal('double accept');
    const quoteId = await createQuote(dealId);
    const token = await sendQuote(quoteId);

    await acceptPublicQuote(token);
    const { acceptedAt } = await getQuote(quoteId);
    const second = await acceptPublicQuote(token);

    expect(second.status).toBe(200);
    expect((await getQuote(quoteId)).acceptedAt).toBe(acceptedAt);
  });

  it('supersedes the other open quotes on the deal, and only one can win', async () => {
    const dealId = await newDeal('supersede');
    const winnerId = await createQuote(dealId, { name: 'Option A' });
    const otherSentId = await createQuote(dealId, { name: 'Option B' });
    const otherDraftId = await createQuote(dealId, { name: 'Option C' });
    const winnerToken = await sendQuote(winnerId);
    const otherToken = await sendQuote(otherSentId);

    await acceptPublicQuote(winnerToken);

    expect((await getQuote(otherSentId)).status).toBe('SUPERSEDED');
    expect((await getQuote(otherDraftId)).status).toBe('SUPERSEDED');

    const replacedPage = await viewPublicQuote(otherToken);

    expect(replacedPage.status).toBe(410);
    expect(replacedPage.html).toContain('Quote replaced');
    expect((await acceptPublicQuote(otherToken)).status).toBe(410);
  });

  it('refuses expired quotes but still shows them', async () => {
    const dealId = await newDeal('expired');
    const quoteId = await createQuote(dealId, { expiresAt: isoDateFromToday(5) });
    const token = await sendQuote(quoteId);

    await gql(`mutation($id: UUID!, $d: QuoteUpdateInput!) { updateQuote(id: $id, data: $d) { id } }`, {
      id: quoteId,
      d: { expiresAt: isoDateFromToday(-1) },
    });

    const page = await viewPublicQuote(token);
    const accept = await acceptPublicQuote(token);

    expect(page.status).toBe(200);
    expect(page.html).toContain('This quote expired on');
    expect(page.html).not.toContain('<form');
    expect(accept.status).toBe(410);
    expect((await getQuote(quoteId)).status).toBe('SENT');
  });

  it('still records the amount when the configured won stage does not exist', async () => {
    const { data } = await metadata<{
      findManyApplications: { id: string; universalIdentifier: string }[];
    }>(`{ findManyApplications { id universalIdentifier } }`);
    const applicationId = data?.findManyApplications.find(
      (application) => application.universalIdentifier === APPLICATION_UNIVERSAL_IDENTIFIER,
    )?.id;

    const setWonStage = async (value: string) => {
      const result = await metadata(
        `mutation($value: String!, $applicationId: UUID) {
          updateOneApplicationVariable(key: "WON_STAGE", value: $value, applicationId: $applicationId) }`,
        { value, applicationId },
      );

      expect(result.errors).toBeUndefined();
    };

    expect(applicationId).toBeDefined();

    const dealId = await newDeal('stage fallback', 'MEETING');
    const token = await sendQuote(await createQuote(dealId, DESIGN_DOC_EXAMPLE));

    await setWonStage('NOT_A_REAL_STAGE');

    try {
      const accept = await acceptPublicQuote(token);
      const deal = await getDeal(dealId);

      expect(accept.status).toBe(200);
      expect(deal?.stage).toBe('MEETING');
      expect(Number(deal?.amount.amountMicros)).toBe(majorToMicros(6903));
    } finally {
      await setWonStage(DEFAULT_WON_STAGE);
    }
  });
});
