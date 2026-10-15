import { describe, expect, it } from 'vitest';

import {
  escapeHtml,
  renderMessagePage,
  renderQuotePage,
  type PublicQuote,
} from 'src/utils/public-quote-page';
import { majorToMicros } from 'src/utils/quote-totals';

const quote = (overrides: Partial<PublicQuote> = {}): PublicQuote => ({
  name: 'Website Redesign quote',
  status: 'SENT',
  currencyCode: 'USD',
  discountPercent: 10,
  taxPercent: 18,
  sentAt: '2026-10-15T10:00:00.000Z',
  acceptedAt: null,
  companyName: 'Acme Corp',
  lineItems: [
    { name: 'Homepage redesign', quantity: 1, unitPriceMicros: majorToMicros(4000) },
    { name: 'Mobile version', quantity: 1, unitPriceMicros: majorToMicros(2500) },
  ],
  ...overrides,
});

describe('renderQuotePage', () => {
  it('shows line items, discount, tax and the total', () => {
    const html = renderQuotePage({ quote: quote(), acceptActionUrl: './abc/accept' });

    expect(html).toContain('Homepage redesign');
    expect(html).toContain('For Acme Corp');
    expect(html).toContain('Discount (10%)');
    expect(html).toContain('Tax (18%)');
    expect(html).toContain('$6,903.00');
    expect(html).toContain('action="./abc/accept"');
    expect(html).toContain('Accept quote');
  });

  it('escapes user-entered text so it cannot inject markup', () => {
    const html = renderQuotePage({
      quote: quote({
        name: '<script>alert(1)</script>',
        companyName: '"Evil" & Co',
        lineItems: [{ name: '<img src=x onerror=alert(1)>', quantity: 1, unitPriceMicros: 0 }],
      }),
      acceptActionUrl: './abc/accept',
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&quot;Evil&quot; &amp; Co');
  });

  it('replaces the accept button with a confirmation once accepted', () => {
    const html = renderQuotePage({
      quote: quote({ status: 'ACCEPTED', acceptedAt: '2026-10-16T10:00:00.000Z' }),
      acceptActionUrl: './abc/accept',
    });

    expect(html).not.toContain('Accept quote');
    expect(html).toContain('Accepted on October 16, 2026');
  });

  it('hides discount and tax rows when they are zero', () => {
    const html = renderQuotePage({
      quote: quote({ discountPercent: 0, taxPercent: 0 }),
      acceptActionUrl: './abc/accept',
    });

    expect(html).not.toContain('Discount (');
    expect(html).not.toContain('Tax (');
    expect(html).toContain('$6,500.00');
  });
});

describe('renderMessagePage', () => {
  it('escapes its title and message', () => {
    const html = renderMessagePage('<b>Oops</b>', 'a < b');

    expect(html).toContain('&lt;b&gt;Oops&lt;/b&gt;');
    expect(html).toContain('a &lt; b');
  });
});

describe('escapeHtml', () => {
  it('escapes all HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});
