import { describe, expect, it } from 'vitest';

import {
  escapeHtml,
  renderMessagePage,
  renderQuotePage,
  type PublicQuote,
} from 'src/utils/public-quote-page';
import { majorToMicros } from 'src/utils/quote-totals';

const quote = (overrides: Partial<PublicQuote> = {}): PublicQuote => ({
  reference: 'Q-FB2CEDE7',
  name: 'Website Redesign quote',
  status: 'SENT',
  currencyCode: 'USD',
  discountPercent: 10,
  taxPercent: 18,
  sentAt: '2026-10-15T10:00:00.000Z',
  acceptedAt: null,
  expiresAt: null,
  message: null,
  terms: null,
  companyName: 'Acme Corp',
  seller: { name: null, logoUrl: null },
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

  it('offers a PDF download and names the document after the quote and reference', () => {
    const html = renderQuotePage({ quote: quote(), acceptActionUrl: './abc/accept' });

    expect(html).toContain('onclick="window.print()"');
    expect(html).toContain('Download PDF');
    expect(html).toContain('<title>Website Redesign quote (Q-FB2CEDE7)</title>');
    expect(html).toContain('Quote Q-FB2CEDE7 · Prepared with QuoteFlow');
  });

  it('opens the print dialog on load only when asked to', () => {
    const plain = renderQuotePage({ quote: quote(), acceptActionUrl: './abc/accept' });
    const printing = renderQuotePage({
      quote: quote(),
      acceptActionUrl: './abc/accept',
      autoPrint: true,
    });

    expect(plain).not.toContain('<script>');
    expect(printing).toContain("window.addEventListener('load'");
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

describe('renderQuotePage details', () => {
  it('shows the seller, validity date, message and terms', () => {
    const html = renderQuotePage({
      quote: quote({
        seller: { name: 'Northwind Studio', logoUrl: 'https://northwind.test/logo.png' },
        expiresAt: '2026-11-17',
        message: 'Thanks for the call!\nHere is the proposal.',
        terms: 'Net 30. 50% upfront.',
      }),
      acceptActionUrl: './abc/accept',
    });

    expect(html).toContain('<img src="https://northwind.test/logo.png" alt="Northwind Studio">');
    expect(html).toContain('<span>Northwind Studio</span>');
    expect(html).toContain('Valid until November 17, 2026');
    expect(html).toContain('<p class="prose">Thanks for the call!\nHere is the proposal.</p>');
    expect(html).toContain('<h2>Terms</h2><p class="terms">Net 30. 50% upfront.</p>');
  });

  it('escapes the seller name, message and terms', () => {
    const html = renderQuotePage({
      quote: quote({
        seller: { name: '<b>Evil</b>', logoUrl: null },
        message: '<script>x</script>',
        terms: '<img src=x onerror=y>',
      }),
      acceptActionUrl: './abc/accept',
    });

    expect(html).not.toContain('<b>Evil</b>');
    expect(html).not.toContain('<script>x</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt;');
  });

  it('replaces the accept button with an expiry notice once expired', () => {
    const html = renderQuotePage({
      quote: quote({ expiresAt: '2026-10-01' }),
      acceptActionUrl: './abc/accept',
      isExpired: true,
    });

    expect(html).not.toContain('<form');
    expect(html).toContain('This quote expired on October 1, 2026');
  });

  it('renders a preview with a banner and no working actions', () => {
    const html = renderQuotePage({ quote: quote(), acceptActionUrl: '', isPreview: true });

    expect(html).toContain('Preview — this is what your client will see');
    expect(html).not.toContain('<form');
    expect(html).toContain('<button type="button" disabled>Accept quote</button>');
    expect(html).toContain('onclick="window.print()" disabled');
  });

  it('omits empty optional sections', () => {
    const html = renderQuotePage({
      quote: quote({ message: '   ', terms: '' }),
      acceptActionUrl: './abc/accept',
    });

    expect(html).not.toContain('class="prose"');
    expect(html).not.toContain('<h2>Terms</h2>');
    expect(html).not.toContain('class="seller"');
  });
});
