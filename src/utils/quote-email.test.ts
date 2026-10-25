import { describe, expect, it } from 'vitest';

import { buildQuoteEmail, LINK_PLACEHOLDER, toMailtoUrl, toPlainEmail } from 'src/utils/quote-email';

const input = {
  reference: 'Q-0007',
  quoteName: 'Website Redesign quote',
  total: '$6,903.00',
  validUntil: 'Nov 17, 2026',
  message: '',
  contactName: 'Samira Hadid',
  contactEmail: 'samira@acme.test',
  sellerName: 'Northwind Studio',
  clientUrl: 'https://crm.test/s/quote/abc',
};

describe('buildQuoteEmail', () => {
  it('addresses the contact and sums up the quote with its link', () => {
    const email = buildQuoteEmail(input);

    expect(email.to).toBe('samira@acme.test');
    expect(email.subject).toBe('Quote Q-0007 from Northwind Studio: Website Redesign quote');
    expect(email.body).toBe(
      [
        'Hi Samira,',
        '',
        'Please find our quote below.',
        '',
        'Quote Q-0007: Website Redesign quote',
        'Total: $6,903.00',
        'Valid until: Nov 17, 2026',
        '',
        'You can view, download and accept the quote here:',
        'https://crm.test/s/quote/abc',
        '',
        'Best regards,',
        'Northwind Studio',
      ].join('\n'),
    );
  });

  it('uses the message to the client as the introduction', () => {
    expect(buildQuoteEmail({ ...input, message: 'Great talking today!' }).body).toContain(
      'Hi Samira,\n\nGreat talking today!\n\nQuote Q-0007',
    );
  });

  it('copes with a deal that has no contact, seller name or expiry', () => {
    const email = buildQuoteEmail({
      ...input,
      contactName: null,
      contactEmail: null,
      sellerName: null,
      validUntil: null,
    });

    expect(email.to).toBe('');
    expect(email.subject).toBe('Quote Q-0007: Website Redesign quote');
    expect(email.body.startsWith('Hi,\n')).toBe(true);
    expect(email.body).not.toContain('Valid until');
    expect(email.body.endsWith('Best regards,')).toBe(true);
  });

  it('shows a placeholder until the quote has a link', () => {
    expect(buildQuoteEmail({ ...input, clientUrl: null }).body).toContain(LINK_PLACEHOLDER);
  });
});

describe('toMailtoUrl', () => {
  it('encodes the subject and body but keeps the address readable', () => {
    const url = toMailtoUrl({ to: 'samira@acme.test', subject: 'Quote Q-0007 & more', body: 'Hi,\nLine 2' });

    expect(url).toBe('mailto:samira@acme.test?subject=Quote%20Q-0007%20%26%20more&body=Hi%2C%0ALine%202');
  });

  it('keeps several comma-separated addresses', () => {
    expect(toMailtoUrl({ to: 'a@x.test, b@x.test', subject: '', body: '' })).toMatch(
      /^mailto:a@x.test,%20b@x.test\?/,
    );
  });
});

describe('toPlainEmail', () => {
  it('puts the recipient and subject above the body', () => {
    expect(toPlainEmail({ to: 'a@x.test', subject: 'Hello', body: 'Body' })).toBe(
      'To: a@x.test\nSubject: Hello\n\nBody',
    );
    expect(toPlainEmail({ to: '', subject: 'Hello', body: 'Body' })).toBe('Subject: Hello\n\nBody');
  });
});
