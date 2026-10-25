import { computeQuoteTotals, formatMoney } from 'src/utils/quote-totals';

export type QuoteSeller = {
  name: string | null;
  logoUrl: string | null;
  addressLines: string[];
  email: string | null;
  phone: string | null;
  website: string | null;
  taxId: string | null;
  paymentInstructions: string | null;
  accentColor: string | null;
};

export const EMPTY_SELLER: QuoteSeller = {
  name: null,
  logoUrl: null,
  addressLines: [],
  email: null,
  phone: null,
  website: null,
  taxId: null,
  paymentInstructions: null,
  accentColor: null,
};

// Who the quote is for, taken from the deal's company and point of contact.
export type QuoteClient = {
  companyName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  addressLines: string[];
};

export const EMPTY_CLIENT: QuoteClient = {
  companyName: null,
  contactName: null,
  contactEmail: null,
  addressLines: [],
};

export type PublicQuote = {
  reference: string;
  name: string;
  status: string;
  currencyCode: string;
  discountPercent: number;
  taxPercent: number;
  sentAt: string | null;
  acceptedAt: string | null;
  expiresAt: string | null;
  message: string | null;
  terms: string | null;
  client: QuoteClient;
  seller: QuoteSeller;
  lineItems: { name: string; quantity: number; unitPriceMicros: number }[];
};

// Everything a workspace member typed goes through this before reaching the page.
export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Dates are formatted in UTC so a DATE value like 2026-11-17 never shifts a day.
const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T00:00:00.000Z` : iso).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : '';

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);


// A printed-document look: light paper on a soft grey page, in every color scheme.
const STYLES = `
  :root { color-scheme: light; --page: #f5f6f8; --card: #fff; --text: #1a1a1a; --muted: #555;
    --faint: #888; --line: #eee; --soft: #f4f5f7; --foot: #fafbfc; --accent: #1961ed;
    --success: #1f8a4c; --warning: #b35c00; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page); color: var(--text);
    font: 14.5px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  main { padding: 40px 16px; }
  .toolbar, .preview-banner { max-width: 860px; margin: 0 auto 12px; }
  .toolbar { display: flex; justify-content: flex-end; }
  .preview-banner { padding: 8px 12px; border-radius: 8px; border: 1px dashed #ccc; color: var(--muted);
    font-size: 13px; text-align: center; }
  .invoice-card { max-width: 860px; margin: 0 auto; background: var(--card); border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06); padding: 48px 56px 40px; overflow-wrap: anywhere; }

  .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;
    margin-bottom: 48px; }
  .logo-area { max-width: 240px; min-width: 0; }
  .logo { display: block; max-height: 72px; max-width: 220px; object-fit: contain; }
  .logo-fallback { display: flex; align-items: center; min-height: 64px; }
  .logo-text { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.1; }
  .title-area { text-align: right; flex-shrink: 0; }
  .title-area h1 { font-size: 56px; font-weight: 800; letter-spacing: -1.5px; margin: 0 0 8px; line-height: 1; }
  .meta { font-size: 14px; color: var(--muted); }
  .meta .value, .date-issued .value { font-weight: 600; color: #111; }

  .bill-to { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 40px; line-height: 1.7; }
  .bill-to h2 { font-size: 13px; font-weight: 700; letter-spacing: 0.6px; margin: 0 0 12px; text-transform: uppercase; }
  .bill-to p { margin: 0; display: flex; gap: 8px; }
  .bill-to strong { min-width: 68px; font-weight: 600; flex-shrink: 0; }
  .date-issued { align-self: flex-end; flex-shrink: 0; }
  .date-issued p { justify-content: flex-end; }
  .date-issued span:first-child { color: var(--muted); }

  .intro { margin-bottom: 28px; }
  .intro h2 { font-size: 18px; font-weight: 700; margin: 0 0 6px; }
  .intro p { margin: 0; white-space: pre-wrap; color: #333; }

  .table-wrapper { margin-bottom: 32px; }
  .table-header, .table-row { display: grid; grid-template-columns: minmax(0, 1fr) 100px 120px 120px; gap: 8px; }
  .table-header { background: var(--soft); padding: 14px 20px; font-size: 12.5px; font-weight: 700;
    letter-spacing: 0.4px; border-radius: 8px; }
  .table-row { padding: 16px 20px; border-bottom: 1px solid var(--line); }
  .table-row:last-child { border-bottom: none; }
  .table-header span:nth-child(n+2), .table-row span:nth-child(n+2) { text-align: right;
    font-variant-numeric: tabular-nums; white-space: nowrap; }
  .empty-row { padding: 40px 20px; text-align: center; color: var(--faint); }

  .totals { width: 280px; max-width: 100%; margin: 0 0 40px auto; font-variant-numeric: tabular-nums; }
  .totals-line { display: flex; justify-content: space-between; gap: 16px; padding: 6px 0; }
  .totals-line.total { background: var(--soft); margin-top: 8px; padding: 12px 16px; border-radius: 8px;
    font-weight: 700; font-size: 16px; }

  .payment { margin-bottom: 40px; line-height: 1.6; }
  .payment h3 { margin: 0 0 10px; font-size: 15px; font-weight: 700; }
  .payment-body p { margin: 0 0 4px; }
  .payment-body p:last-child { margin-bottom: 0; }
  .terms h3 { margin: 0 0 8px; font-size: 15px; font-weight: 700; }

  .actions { display: flex; justify-content: flex-end; margin-bottom: 32px; }
  button { background: var(--accent); color: #fff; border: 0; border-radius: 8px; padding: 12px 24px;
    font: inherit; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: default; }
  button.secondary { background: var(--card); color: var(--text); border: 1px solid #ddd;
    padding: 8px 16px; font-weight: 500; font-size: 14px; }
  .notice { margin-bottom: 32px; padding: 12px 16px; border-radius: 8px; border: 1px solid var(--success);
    color: var(--success); text-align: center; font-weight: 600; }
  .notice.warning { border-color: var(--warning); color: var(--warning); }

  .invoice-footer { display: flex; justify-content: space-between; gap: 40px; border-top: 1px solid var(--line);
    font-size: 13.5px; line-height: 1.6; background: var(--foot); margin: 0 -56px -40px;
    padding: 32px 56px 40px; border-radius: 0 0 16px 16px; }
  .terms { min-width: 0; }
  .terms ul { margin: 0; padding-left: 18px; }
  .seller-contact { min-width: 0; }
  .seller-contact p { margin: 0 0 6px; display: flex; align-items: baseline; gap: 8px; }
  .seller-contact .icon { font-size: 14px; width: 18px; flex-shrink: 0; text-align: center; }

  .credit { text-align: center; color: var(--faint); font-size: 12px; margin: 16px 0 0; }
  .print-only { display: none; }

  @media (max-width: 640px) {
    main { padding: 16px 12px; }
    .invoice-card { padding: 28px 20px 24px; }
    .invoice-header, .bill-to, .invoice-footer { flex-direction: column; }
    .title-area { text-align: left; }
    .title-area h1 { font-size: 40px; }
    .date-issued { align-self: flex-start; }
    .date-issued p { justify-content: flex-start; }
    /* Each line item's description gets its own row; quantity, rate and total sit under it. */
    .table-header, .table-row { grid-template-columns: 44px minmax(0, 1fr) minmax(0, 1fr); row-gap: 4px;
      padding-left: 12px; padding-right: 12px; }
    .table-header span:first-child, .table-row span:first-child { grid-column: 1 / -1; }
    .table-header span:nth-child(2), .table-row span:nth-child(2) { text-align: left; }
    .table-header span:nth-child(2) { font-size: 0; }
    .table-header span:nth-child(2)::after { content: "QTY"; font-size: 12.5px; }
    .invoice-footer { gap: 20px; margin: 0 -20px -24px; padding: 24px 20px; }
  }

  /* No page margin, so the browser has no room to print its own header and footer: those carry the
     page address, and with it the quote's secret link. The spacing lives on main instead. */
  @page { margin: 0; }
  @media print {
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { background: #fff; font-size: 10.5pt; }
    main { padding: 14mm 16mm; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
    .invoice-card { max-width: none; box-shadow: none; border-radius: 0; padding: 0; }
    /* Tighter vertical rhythm than on screen, so a typical quote fits on one page. */
    .invoice-header { margin-bottom: 24px; }
    .title-area h1 { font-size: 44px; }
    .bill-to { margin-bottom: 20px; line-height: 1.5; }
    .totals-line { padding: 3px 0; }
    .payment { line-height: 1.45; }
    .intro { margin-bottom: 16px; }
    .table-wrapper { margin-bottom: 16px; }
    .table-row { padding-top: 12px; padding-bottom: 12px; }
    .totals { margin-bottom: 24px; }
    .payment { margin-bottom: 20px; }
    .invoice-footer { margin: 0; padding: 16px 24px; border-radius: 8px; }
    .table-row, .totals, .payment, .invoice-footer, .notice { break-inside: avoid; }
    .toolbar, .actions, .preview-banner, .credit { display: none; }
    .print-only { display: block; text-align: center; margin-top: 12px; color: var(--faint); font-size: 8pt; }
  }
`;

// Opening the page with ?print=1 brings up the print dialog, where "Save as PDF" makes the file.
const AUTO_PRINT_SCRIPT = `<script>window.addEventListener('load', function () { window.print(); });</script>`;

const renderDocument = (
  title: string,
  content: string,
  { autoPrint = false, accentColor = null }: { autoPrint?: boolean; accentColor?: string | null } = {},
) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>${STYLES}${accentColor ? `:root { --accent: ${accentColor}; }` : ''}</style>
${autoPrint ? AUTO_PRINT_SCRIPT : ''}
</head>
<body><main>${content}<p class="credit">Sent with QuoteFlow</p></main></body>
</html>`;

const DASH = '—';

const textOrDash = (value: string | null | undefined) => escapeHtml(value?.trim() || DASH);

const renderLogo = (seller: QuoteSeller) =>
  seller.logoUrl
    ? `<img class="logo" src="${escapeHtml(seller.logoUrl)}" alt="${escapeHtml(seller.name ?? 'Logo')}">`
    : `<div class="logo-fallback"><span class="logo-text">${escapeHtml(seller.name ?? '')}</span></div>`;

// "Name" is the client's company, or the contact when the deal has no company; the contact
// person then moves to "Contact" next to their email.
const renderBillTo = (client: QuoteClient) => {
  const name = client.companyName ?? client.contactName;
  const contact = [client.companyName ? client.contactName : null, client.contactEmail]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' · ');

  return `<div>
          <h2>Quote to</h2>
          <p><strong>Name</strong><span>: ${textOrDash(name)}</span></p>
          <p><strong>Address</strong><span>: ${textOrDash(client.addressLines.join(', '))}</span></p>
          <p><strong>Contact</strong><span>: ${textOrDash(contact)}</span></p>
        </div>`;
};

const renderDates = (quote: PublicQuote) => `<div class="date-issued">
          <p><span>Date Issued</span><span class="value">: ${escapeHtml(quote.sentAt ? formatDate(quote.sentAt) : DASH)}</span></p>
          <p><span>Valid Until</span><span class="value">: ${escapeHtml(quote.expiresAt ? formatDate(quote.expiresAt) : 'No expiry')}</span></p>
        </div>`;

const splitLines = (text: string | null | undefined, separator: RegExp = /\n/) =>
  (text ?? '')
    .split(separator)
    .map((line) => line.trim())
    .filter(Boolean);

const renderFooter = (quote: PublicQuote) => {
  const terms = splitLines(quote.terms);
  const { seller } = quote;
  const contacts = [
    seller.phone ? ['☎', seller.phone] : null,
    seller.email ? ['✉', seller.email] : null,
    seller.website ? ['⌁', seller.website] : null,
    seller.addressLines.length > 0 ? ['⌂', seller.addressLines.join(', ')] : null,
    seller.taxId ? ['#', seller.taxId] : null,
  ].filter((entry): entry is string[] => entry !== null);

  if (terms.length === 0 && contacts.length === 0) {
    return '';
  }

  return `<footer class="invoice-footer">
        <div class="terms">${
          terms.length > 0
            ? `<h3>Terms &amp; Conditions</h3><ul>${terms.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
            : ''
        }</div>
        <div class="seller-contact">${contacts
          .map(([icon, value]) => `<p><span class="icon" aria-hidden="true">${icon}</span>${escapeHtml(value ?? '')}</p>`)
          .join('')}</div>
      </footer>`;
};

const renderOutcome = ({
  quote,
  acceptActionUrl,
  isExpired,
  isPreview,
}: {
  quote: PublicQuote;
  acceptActionUrl: string;
  isExpired: boolean;
  isPreview: boolean;
}) => {
  if (quote.status === 'ACCEPTED') {
    return `<div class="notice">Accepted${quote.acceptedAt ? ` on ${formatDate(quote.acceptedAt)}` : ''}. Thank you!</div>`;
  }

  if (isExpired) {
    return `<div class="notice warning">This quote expired on ${formatDate(quote.expiresAt)}. Please contact the sender for an updated quote.</div>`;
  }

  if (isPreview) {
    return `<div class="actions"><button type="button" disabled>Accept quote</button></div>`;
  }

  return `<form class="actions" method="post" action="${escapeHtml(acceptActionUrl)}">
          <button type="submit">Accept quote</button>
        </form>`;
};

export const renderQuotePage = ({
  quote,
  acceptActionUrl,
  autoPrint = false,
  isExpired = false,
  isPreview = false,
}: {
  quote: PublicQuote;
  acceptActionUrl: string;
  autoPrint?: boolean;
  isExpired?: boolean;
  isPreview?: boolean;
}) => {
  const totals = computeQuoteTotals({
    lines: quote.lineItems.map(({ quantity, unitPriceMicros }) => ({ quantity, unitPriceMicros })),
    discountPercent: quote.discountPercent,
    taxPercent: quote.taxPercent,
  });
  const money = (micros: number) => escapeHtml(formatMoney(micros, quote.currencyCode));

  const rows =
    quote.lineItems.length === 0
      ? '<div class="empty-row">No line items</div>'
      : quote.lineItems
          .map(
            (lineItem, index) => `<div class="table-row">
            <span>${escapeHtml(lineItem.name)}</span>
            <span>${formatNumber(lineItem.quantity)}</span>
            <span>${money(lineItem.unitPriceMicros)}</span>
            <span>${money(totals.lineTotalsMicros[index] ?? 0)}</span>
          </div>`,
          )
          .join('');

  const message = quote.message?.trim();
  // The setting is a single-line field, so "|" also starts a new line.
  const paymentLines = splitLines(quote.seller.paymentInstructions, /\n|\|/);

  // The document title becomes the default PDF file name.
  return renderDocument(
    `${quote.name} (${quote.reference})`,
    `${isPreview ? '<div class="preview-banner">Preview — this is what your client will see</div>' : ''}
    <div class="toolbar">
      <button type="button" class="secondary" onclick="window.print()"${isPreview ? ' disabled' : ''}>Download PDF</button>
    </div>
    <div class="invoice-card">
      <header class="invoice-header">
        <div class="logo-area">${renderLogo(quote.seller)}</div>
        <div class="title-area">
          <h1>QUOTE</h1>
          <div class="meta"><span>Quote Number</span><span class="value">: ${escapeHtml(quote.reference)}</span></div>
        </div>
      </header>
      <section class="bill-to">
        ${renderBillTo(quote.client)}
        ${renderDates(quote)}
      </section>
      <section class="intro">
        <h2>${escapeHtml(quote.name)}</h2>
        ${message ? `<p>${escapeHtml(message)}</p>` : ''}
      </section>
      <div class="table-wrapper">
        <div class="table-header"><span>DESCRIPTION</span><span>QUANTITY</span><span>RATE</span><span>TOTAL</span></div>
        <div class="table-body">${rows}</div>
      </div>
      <div class="totals">
        <div class="totals-line"><span>SUBTOTAL</span><span>${money(totals.subtotalMicros)}</span></div>
        ${
          totals.discountMicros > 0
            ? `<div class="totals-line"><span>DISCOUNT (${formatNumber(quote.discountPercent)}%)</span><span>−${money(totals.discountMicros)}</span></div>`
            : ''
        }
        <div class="totals-line"><span>TAX RATE (%)</span><span>${formatNumber(quote.taxPercent)}%</span></div>
        <div class="totals-line"><span>TAX</span><span>${money(totals.taxMicros)}</span></div>
        <div class="totals-line total"><span>TOTAL</span><span>${money(totals.totalMicros)}</span></div>
      </div>
      ${
        paymentLines.length > 0
          ? `<section class="payment"><h3>Payment Instructions</h3><div class="payment-body">${paymentLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</div></section>`
          : ''
      }
      ${renderOutcome({ quote, acceptActionUrl, isExpired, isPreview })}
      ${renderFooter(quote)}
    </div>
    <p class="print-only">Quote ${escapeHtml(quote.reference)} · Prepared with QuoteFlow</p>`,
    { autoPrint, accentColor: quote.seller.accentColor },
  );
};

export const renderMessagePage = (title: string, message: string) =>
  renderDocument(
    title,
    `<div class="invoice-card"><section class="intro"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></section></div>`,
  );
