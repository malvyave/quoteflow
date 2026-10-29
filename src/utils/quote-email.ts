// The email a member sends their client with the quote link. QuoteFlowin does not send email
// itself: the member opens this in their own email app or copies it.

export type QuoteEmail = { to: string; subject: string; body: string };

export const LINK_PLACEHOLDER = '[the quote link appears here once you send the quote]';

export const buildQuoteEmail = ({
  reference,
  quoteName,
  total,
  validUntil,
  message,
  contactName,
  contactEmail,
  sellerName,
  clientUrl,
}: {
  reference: string;
  quoteName: string;
  // Already formatted, e.g. "$6,903.00" and "Nov 17, 2026".
  total: string;
  validUntil: string | null;
  message: string;
  contactName: string | null;
  contactEmail: string | null;
  sellerName: string | null;
  clientUrl: string | null;
}): QuoteEmail => {
  const firstName = contactName?.trim().split(/\s+/)[0] ?? '';
  const name = quoteName.trim() || 'Quote';
  const intro = message.trim() || 'Please find our quote below.';

  const body = [
    firstName ? `Hi ${firstName},` : 'Hi,',
    '',
    intro,
    '',
    `Quote ${reference}: ${name}`,
    `Total: ${total}`,
    ...(validUntil ? [`Valid until: ${validUntil}`] : []),
    '',
    'You can view, download and accept the quote here:',
    clientUrl ?? LINK_PLACEHOLDER,
    '',
    'Best regards,',
    ...(sellerName?.trim() ? [sellerName.trim()] : []),
  ].join('\n');

  return {
    to: contactEmail?.trim() ?? '',
    subject: sellerName?.trim()
      ? `Quote ${reference} from ${sellerName.trim()}: ${name}`
      : `Quote ${reference}: ${name}`,
    body,
  };
};

// Mail apps expect "@" and "," unescaped in the address part.
export const toMailtoUrl = (email: QuoteEmail) => {
  const to = encodeURIComponent(email.to.trim()).replace(/%40/g, '@').replace(/%2C/g, ',');

  return `mailto:${to}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
};

// What "Copy email" puts on the clipboard, ready to paste into any mail or chat app.
export const toPlainEmail = (email: QuoteEmail) =>
  [email.to ? `To: ${email.to}` : null, `Subject: ${email.subject}`, '', email.body]
    .filter((line): line is string => line !== null)
    .join('\n');
