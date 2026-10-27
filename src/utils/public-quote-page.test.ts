import { describe, expect, it } from 'vitest';

import {
  escapeHtml,
  renderMessagePage,
  renderQuotePage,
  EMPTY_CLIENT,
  EMPTY_SELLER,
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
  acceptedByName: null,
  expiresAt: null,
  message: null,
  terms: null,
  client: { ...EMPTY_CLIENT, companyName: 'Acme Corp' },
  seller: EMPTY_SELLER,
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
    expect(html).toContain('<h1>QUOTE</h1>');
    expect(html).toContain('<span>Quote Number</span><span class="value">: Q-FB2CEDE7</span>');
    expect(html).toContain('<p><strong>Name</strong><span>: Acme Corp</span></p>');
    expect(html).toContain('DISCOUNT (10%)');
    expect(html).toContain('<span>TAX RATE (%)</span><span>18%</span>');
    expect(html).toContain('$6,903.00');
    expect(html).toContain('action="./abc/accept"');
    expect(html).toContain('Accept quote');
  });

  it('escapes user-entered text so it cannot inject markup', () => {
    const html = renderQuotePage({
      quote: quote({
        name: '<script>alert(1)</script>',
        client: { ...EMPTY_CLIENT, companyName: '"Evil" & Co' },
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

  it('hides the discount row when there is none, and always shows the tax rate', () => {
    const html = renderQuotePage({
      quote: quote({ discountPercent: 0, taxPercent: 0 }),
      acceptActionUrl: './abc/accept',
    });

    expect(html).not.toContain('DISCOUNT (');
    expect(html).toContain('<span>TAX RATE (%)</span><span>0%</span>');
    expect(html).toContain('$6,500.00');
  });
});

describe('renderMessagePage', () => {
  it('escapes its title and message', () => {
    const html = renderMessagePage('<b>Oops</b>', 'a < b');

    expect(html).toContain('&lt;b&gt;Oops&lt;/b&gt;');
    expect(html).toContain('a &lt; b');
  });

  // The quote link is a secret, so it must not reach search engines or the sites the page links to.
  it('keeps the page out of search results and its address out of referrers', () => {
    const html = renderMessagePage('Title', 'Message');

    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toContain('<meta name="referrer" content="no-referrer">');
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
        seller: { ...EMPTY_SELLER, name: 'Northwind Studio', logoUrl: 'https://northwind.test/logo.png' },
        expiresAt: '2026-11-17',
        message: 'Thanks for the call!\nHere is the proposal.',
        terms: 'Net 30. 50% upfront.',
      }),
      acceptActionUrl: './abc/accept',
    });

    expect(html).toContain('<img class="logo" src="https://northwind.test/logo.png" alt="Northwind Studio">');
    expect(html).toContain('<span>Valid Until</span><span class="value">: November 17, 2026</span>');
    expect(html).toContain('<p>Thanks for the call!\nHere is the proposal.</p>');
    expect(html).toContain('<h3>Terms &amp; Conditions</h3><ul><li>Net 30. 50% upfront.</li></ul>');
  });

  it('escapes the seller name, message and terms', () => {
    const html = renderQuotePage({
      quote: quote({
        seller: { ...EMPTY_SELLER, name: '<b>Evil</b>' },
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

    expect(html).not.toContain('Terms &amp; Conditions');
    expect(html).not.toContain('Payment Instructions');
    expect(html).not.toContain('class="invoice-footer"');
  });

  it('addresses the client by company, contact and address', () => {
    const html = renderQuotePage({
      quote: quote({
        client: {
          companyName: 'Acme Corp',
          contactName: 'Samira Hadid',
          contactEmail: 'samira@acme.test',
          addressLines: ['123 Anywhere St.', 'Any City, ST 12345'],
        },
      }),
      acceptActionUrl: './abc/accept',
    });

    expect(html).toContain('<p><strong>Name</strong><span>: Acme Corp</span></p>');
    expect(html).toContain('<p><strong>Address</strong><span>: 123 Anywhere St., Any City, ST 12345</span></p>');
    expect(html).toContain('<p><strong>Contact</strong><span>: Samira Hadid · samira@acme.test</span></p>');
  });

  it('names the contact when the deal has no company, and shows dashes for missing details', () => {
    const withContactOnly = renderQuotePage({
      quote: quote({ client: { ...EMPTY_CLIENT, contactName: 'Samira Hadid' } }),
      acceptActionUrl: './abc/accept',
    });
    const empty = renderQuotePage({ quote: quote({ client: EMPTY_CLIENT }), acceptActionUrl: './abc/accept' });

    expect(withContactOnly).toContain('<strong>Name</strong><span>: Samira Hadid</span>');
    expect(withContactOnly).toContain('<strong>Contact</strong><span>: —</span>');
    expect(empty).toContain('<strong>Name</strong><span>: —</span>');
  });

  it('shows the seller name in place of a logo', () => {
    const html = renderQuotePage({
      quote: quote({ seller: { ...EMPTY_SELLER, name: 'Northwind Studio' } }),
      acceptActionUrl: './abc/accept',
    });

    expect(html).toContain('<span class="logo-text">Northwind Studio</span>');
    expect(html).not.toContain('<img');
  });

  it('shows the seller details, tax ID and payment instructions', () => {
    const html = renderQuotePage({
      quote: quote({
        seller: {
          ...EMPTY_SELLER,
          name: 'Northwind Studio',
          taxId: 'GSTIN 29ABCDE1234F1Z5',
          phone: '+91 98765 43210',
          email: 'hello@northwind.test',
          website: 'northwind.test',
          addressLines: ['12 MG Road', 'Bengaluru 560001'],
          paymentInstructions: 'UPI: northwind@bank',
        },
      }),
      acceptActionUrl: './abc/accept',
    });

    expect(html).toContain('<span class="icon" aria-hidden="true">☎</span>+91 98765 43210');
    expect(html).toContain('<span class="icon" aria-hidden="true">✉</span>hello@northwind.test');
    expect(html).toContain('<span class="icon" aria-hidden="true">⌂</span>12 MG Road, Bengaluru 560001');
    expect(html).toContain('<span class="icon" aria-hidden="true">#</span>GSTIN 29ABCDE1234F1Z5');
    expect(html).toContain('<h3>Payment Instructions</h3><div class="payment-body"><p>UPI: northwind@bank</p></div>');
  });

  it('breaks payment instructions into lines at | or a newline', () => {
    const html = renderQuotePage({
      quote: quote({
        seller: { ...EMPTY_SELLER, paymentInstructions: 'HDFC Bank | A/C 501001\nIFSC HDFC0001234 |' },
      }),
      acceptActionUrl: './abc/accept',
    });

    expect(html).toContain(
      '<div class="payment-body"><p>HDFC Bank</p><p>A/C 501001</p><p>IFSC HDFC0001234</p></div>',
    );
  });

  it('asks for the name of the person accepting, and offers to decline with a reason', () => {
    const html = renderQuotePage({
      quote: quote(),
      acceptActionUrl: './abc/accept',
      declineActionUrl: './abc/decline',
    });

    expect(html).toContain('<input name="acceptedByName" autocomplete="name" maxlength="120" required>');
    expect(html).toContain('<form method="post" action="./abc/decline">');
    expect(html).toContain('<textarea name="declineReason" maxlength="1000"></textarea>');
  });

  it('offers no decline when there is nowhere to send it', () => {
    expect(renderQuotePage({ quote: quote(), acceptActionUrl: './abc/accept' })).not.toContain('Decline');
  });

  it('names who accepted, escaped', () => {
    const html = renderQuotePage({
      quote: quote({ status: 'ACCEPTED', acceptedAt: '2026-10-20T09:00:00.000Z', acceptedByName: 'Sam <b>' }),
      acceptActionUrl: '',
    });

    expect(html).toContain('Accepted by Sam &lt;b&gt; on October 20, 2026. Thank you!');
    expect(html).not.toContain('acceptedByName');
  });

  it('escapes the client and seller details', () => {
    const html = renderQuotePage({
      quote: quote({
        client: { ...EMPTY_CLIENT, contactName: '<i>x</i>' },
        seller: { ...EMPTY_SELLER, phone: '<b>1</b>', paymentInstructions: '<script>y</script>' },
      }),
      acceptActionUrl: './abc/accept',
    });

    expect(html).not.toContain('<i>x</i>');
    expect(html).not.toContain('<b>1</b>');
    expect(html).not.toContain('<script>y</script>');
  });

  it('uses the brand color as the accent', () => {
    const branded = renderQuotePage({
      quote: quote({ seller: { ...EMPTY_SELLER, accentColor: '#e4572e' } }),
      acceptActionUrl: './abc/accept',
    });
    const plain = renderQuotePage({ quote: quote(), acceptActionUrl: './abc/accept' });

    expect(branded).toContain(':root { --accent: #e4572e; }');
    expect(plain).not.toContain(':root { --accent: #');
  });

  it('prints without page margins, so browsers cannot add the link in a header or footer', () => {
    const html = renderQuotePage({ quote: quote(), acceptActionUrl: './abc/accept' });

    expect(html).toContain('@page { margin: 0; }');
  });
});
