import { afterAll, describe, expect, it } from 'vitest';

import {
  acceptPublicQuote,
  callQuoteAction,
  createDeal,
  createQuote,
  declinePublicQuote,
  destroyDeals,
  getDealTimelineLabels,
  getQuote,
  sendQuote,
  viewPublicQuote,
} from 'src/__tests__/quote-flow-helpers';

// What the client does with a quote link, and what the member then sees: views, acceptance by
// name, declining with a reason, and the deal's timeline.

const createdDeals: string[] = [];

const sentQuote = async (dealName: string) => {
  const dealId = await createDeal(dealName);

  createdDeals.push(dealId);

  const quoteId = await createQuote(dealId);
  const token = await sendQuote(quoteId);

  return { dealId, quoteId, token };
};

afterAll(async () => {
  await destroyDeals(createdDeals);
});

describe('client actions on a quote link', () => {
  it('records the first view, but not the member opening the link from the Quote tab', async () => {
    const { quoteId, token } = await sentQuote('viewed');

    await viewPublicQuote(token, '?from=app');
    expect((await getQuote(quoteId)).viewedAt).toBeNull();

    await viewPublicQuote(token);
    const firstView = (await getQuote(quoteId)).viewedAt;

    expect(firstView).not.toBeNull();

    await viewPublicQuote(token);
    expect((await getQuote(quoteId)).viewedAt).toBe(firstView);
  });

  it('records who accepted the quote and shows it on the page', async () => {
    const { quoteId, token } = await sentQuote('accepted by');

    const { status, html } = await acceptPublicQuote(token, { acceptedByName: '  Samira   Hadid ' });
    const quote = await getQuote(quoteId);

    expect(status).toBe(200);
    expect(quote.status).toBe('ACCEPTED');
    expect(quote.acceptedByName).toBe('Samira Hadid');
    expect(html).toContain('Accepted by Samira Hadid on');
  });

  it('lets the client decline with a reason, which the member can revise and resend', async () => {
    const { quoteId, token } = await sentQuote('declined');

    const { status, html } = await declinePublicQuote(token, { declineReason: 'Over our budget for Q4' });
    const declined = await getQuote(quoteId);

    expect(status).toBe(200);
    expect(html).toContain('Thanks for letting us know.');
    expect(declined.status).toBe('DECLINED');
    expect(declined.declineReason).toBe('Over our budget for Q4');
    expect((await viewPublicQuote(token)).status).toBe(410);
    expect((await acceptPublicQuote(token, { acceptedByName: 'Late' })).status).toBe(410);

    expect((await callQuoteAction('withdraw', { quoteId })).status).toBe(200);

    const revised = await getQuote(quoteId);

    expect(revised.status).toBe('DRAFT');
    // Twenty stores a cleared text field as an empty string.
    expect(revised.declineReason || null).toBeNull();
    expect(revised.publicToken || null).toBeNull();
  });

  it('does not let a client decline a quote that was already accepted', async () => {
    const { quoteId, token } = await sentQuote('accepted then declined');

    await acceptPublicQuote(token, { acceptedByName: 'Theo' });

    expect((await declinePublicQuote(token, { declineReason: 'Changed my mind' })).status).toBe(409);
    expect((await getQuote(quoteId)).status).toBe('ACCEPTED');
  });

  it('adds sent, viewed and accepted to the deal timeline', async () => {
    const { dealId, token } = await sentQuote('timeline');

    await viewPublicQuote(token);
    await acceptPublicQuote(token, { acceptedByName: 'Theo' });

    // Timeline events are written right after each step; give the server a moment.
    await expect
      .poll(() => getDealTimelineLabels(dealId), { timeout: 10_000 })
      .toEqual(expect.arrayContaining(['Quote sent', 'Quote viewed by client', 'Quote accepted']));
  });
});
