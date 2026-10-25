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

const STYLES = `
  :root { color-scheme: light dark; --bg: #f6f6f6; --card: #fff; --text: #1f1f1f; --muted: #6b6b6b;
    --border: #e6e6e6; --soft: #f3f3f3; --accent: #1961ed; --success: #1f8a4c; --warning: #b35c00; }
  @media (prefers-color-scheme: dark) { :root { --bg: #141414; --card: #1d1d1d; --text: #ebebeb;
    --muted: #9a9a9a; --border: #333; --soft: #262626; --accent: #5a8dff; --success: #4cc27f;
    --warning: #f0a35e; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  main { max-width: 760px; margin: 40px auto; padding: 0 16px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .sheet { padding: 40px 40px 32px; }
  .doc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;
    margin-bottom: 32px; }
  .brand { display: flex; flex-direction: column; gap: 8px; font-weight: 600; font-size: 17px; min-width: 0;
    overflow-wrap: anywhere; }
  .brand img { max-height: 56px; max-width: 200px; object-fit: contain; align-self: flex-start; }
  .doc-title { text-align: right; flex-shrink: 0; }
  .doc-kind { font-size: 34px; font-weight: 800; letter-spacing: 0.04em; line-height: 1; text-transform: uppercase; }
  .doc-number { margin-top: 8px; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
  .doc-number strong { color: var(--text); }
  .parties { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
  .label { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; margin: 0 0 6px; }
  .party { font-size: 14px; color: var(--muted); overflow-wrap: anywhere; min-width: 0; }
  .party strong { color: var(--text); font-weight: 600; }
  .dates { display: grid; grid-template-columns: auto auto; gap: 4px 16px; margin: 0; font-size: 14px;
    align-content: start; flex-shrink: 0; }
  .dates dt { color: var(--muted); }
  .dates dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
  h1 { font-size: 20px; margin: 0 0 8px; overflow-wrap: anywhere; }
  .prose { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0 0 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { text-align: left; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    background: var(--soft); padding: 12px; }
  td { padding: 12px; border-bottom: 1px solid var(--border); vertical-align: top; overflow-wrap: anywhere; }
  tbody tr:last-child td { border-bottom: 3px solid var(--text); }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .summary { margin: 16px 0 0 auto; width: min(100%, 300px); }
  .summary div { display: flex; justify-content: space-between; padding: 4px 12px; font-variant-numeric: tabular-nums; }
  .summary .muted { color: var(--muted); }
  .summary .total { font-weight: 700; font-size: 17px; background: var(--soft); border-left: 4px solid var(--accent);
    margin-top: 8px; padding: 10px 12px; }
  .section { margin-top: 28px; }
  .section p { white-space: pre-wrap; overflow-wrap: anywhere; color: var(--muted); font-size: 14px; margin: 0; }
  .toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
  .actions { margin-top: 32px; display: flex; justify-content: flex-end; }
  button { background: var(--accent); color: #fff; border: 0; border-radius: 8px; padding: 12px 24px;
    font: inherit; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: default; }
  button.secondary { background: transparent; color: var(--text); border: 1px solid var(--border);
    padding: 8px 16px; font-weight: 500; font-size: 14px; }
  .notice { margin-top: 32px; padding: 12px 16px; border-radius: 8px; border: 1px solid var(--success);
    color: var(--success); text-align: center; font-weight: 500; }
  .notice.warning { border-color: var(--warning); color: var(--warning); }
  .doc-foot { display: flex; justify-content: space-between; gap: 24px; background: var(--soft);
    padding: 24px 40px; font-size: 13px; color: var(--muted); }
  .doc-foot strong { color: var(--text); }
  .doc-foot > div { min-width: 0; overflow-wrap: anywhere; }
  .doc-foot .contact { text-align: right; }
  .preview-banner { margin-bottom: 12px; padding: 8px 12px; border-radius: 8px; border: 1px dashed var(--border);
    color: var(--muted); font-size: 13px; text-align: center; }
  .credit { text-align: center; color: var(--muted); font-size: 12px; margin-top: 16px; }
  .print-only { display: none; }
  @media (max-width: 560px) {
    main { margin: 16px auto; }
    .sheet { padding: 24px 20px; }
    .doc-head, .parties, .doc-foot { flex-direction: column; }
    .doc-title, .doc-foot .contact { text-align: left; }
    .doc-kind { font-size: 26px; }
    .doc-foot { padding: 20px; }
    th, td { padding: 10px 6px; }
  }
  /* No page margin, so the browser has no room to print its own header and footer: those carry the
     page address, and with it the quote's secret link. The spacing lives on main instead. */
  @page { margin: 0; }
  @media print {
    :root { --bg: #fff; --card: #fff; --text: #111; --muted: #555; --border: #ddd; --soft: #f1f1f1;
      --success: #1f8a4c; --warning: #b35c00; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-size: 11pt; }
    main { max-width: none; margin: 0; padding: 14mm 16mm; -webkit-box-decoration-break: clone;
      box-decoration-break: clone; }
    .card { border: 0; border-radius: 0; overflow: visible; }
    .sheet { padding: 0 0 24px; }
    .doc-foot { padding: 16px 20px; }
    tr { break-inside: avoid; }
    .summary, .section, .doc-foot, .notice { break-inside: avoid; }
    .toolbar, .actions, .preview-banner, .credit { display: none; }
    .print-only { display: block; text-align: center; margin-top: 12px; color: var(--muted); font-size: 8pt; }
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

const lines = (values: (string | null | undefined)[]) =>
  values
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => escapeHtml(value.trim()))
    .join('<br>');

const renderBrand = (seller: QuoteSeller) => {
  const logo = seller.logoUrl
    ? `<img src="${escapeHtml(seller.logoUrl)}" alt="${escapeHtml(seller.name ?? 'Logo')}">`
    : '';

  return `<div class="brand">${logo}${seller.name ? `<span>${escapeHtml(seller.name)}</span>` : ''}</div>`;
};

const renderClient = (client: QuoteClient) => {
  const details = [
    client.companyName ? `<strong>${escapeHtml(client.companyName)}</strong>` : '',
    lines([client.contactName, client.contactEmail, ...client.addressLines]),
  ]
    .filter(Boolean)
    .join('<br>');

  return details ? `<div class="party"><p class="label">Prepared for</p>${details}</div>` : '<div></div>';
};

const renderDates = (quote: PublicQuote) => {
  const rows = [
    ['Date issued', quote.sentAt ? formatDate(quote.sentAt) : 'Not sent yet'],
    ['Valid until', quote.expiresAt ? formatDate(quote.expiresAt) : 'No expiry'],
  ];

  return `<dl class="dates">${rows.map(([term, value]) => `<dt>${term}</dt><dd>${escapeHtml(value ?? '')}</dd>`).join('')}</dl>`;
};

const renderSellerFooter = (seller: QuoteSeller) => {
  const contact = lines([seller.phone, seller.email, seller.website, ...seller.addressLines]);

  if (!contact && !seller.taxId) {
    return '';
  }

  const identity = [seller.name ? `<strong>${escapeHtml(seller.name)}</strong>` : '', lines([seller.taxId])]
    .filter(Boolean)
    .join('<br>');

  return `<div class="doc-foot">
      <div>${identity}</div>
      <div class="contact">${contact}</div>
    </div>`;
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

const renderSection = (label: string, text: string | null | undefined) =>
  text?.trim() ? `<div class="section"><p class="label">${label}</p><p>${escapeHtml(text.trim())}</p></div>` : '';

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

  const rows = quote.lineItems
    .map(
      (lineItem, index) => `<tr>
        <td>${escapeHtml(lineItem.name)}</td>
        <td class="num">${formatNumber(lineItem.quantity)}</td>
        <td class="num">${money(lineItem.unitPriceMicros)}</td>
        <td class="num">${money(totals.lineTotalsMicros[index] ?? 0)}</td>
      </tr>`,
    )
    .join('');

  const message = quote.message?.trim();

  // The document title becomes the default PDF file name.
  return renderDocument(
    `${quote.name} (${quote.reference})`,
    `${isPreview ? '<div class="preview-banner">Preview — this is what your client will see</div>' : ''}
    <div class="toolbar">
      <button type="button" class="secondary" onclick="window.print()"${isPreview ? ' disabled' : ''}>Download PDF</button>
    </div>
    <div class="card">
      <div class="sheet">
        <div class="doc-head">
          ${renderBrand(quote.seller)}
          <div class="doc-title">
            <div class="doc-kind">Quote</div>
            <div class="doc-number">Quote number <strong>${escapeHtml(quote.reference)}</strong></div>
          </div>
        </div>
        <div class="parties">
          ${renderClient(quote.client)}
          ${renderDates(quote)}
        </div>
        <h1>${escapeHtml(quote.name)}</h1>
        ${message ? `<p class="prose">${escapeHtml(message)}</p>` : ''}
        <table>
          <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="summary">
          <div><span class="muted">Subtotal</span><span>${money(totals.subtotalMicros)}</span></div>
          ${
            totals.discountMicros > 0
              ? `<div><span class="muted">Discount (${formatNumber(quote.discountPercent)}%)</span><span>−${money(totals.discountMicros)}</span></div>`
              : ''
          }
          ${
            totals.taxMicros > 0
              ? `<div><span class="muted">Tax (${formatNumber(quote.taxPercent)}%)</span><span>${money(totals.taxMicros)}</span></div>`
              : ''
          }
          <div class="total"><span>Total</span><span>${money(totals.totalMicros)}</span></div>
        </div>
        ${renderSection('Terms', quote.terms)}
        ${renderSection('Payment instructions', quote.seller.paymentInstructions)}
        ${renderOutcome({ quote, acceptActionUrl, isExpired, isPreview })}
      </div>
      ${renderSellerFooter(quote.seller)}
    </div>
    <p class="print-only">Quote ${escapeHtml(quote.reference)} · Prepared with QuoteFlow</p>`,
    { autoPrint, accentColor: quote.seller.accentColor },
  );
};

export const renderMessagePage = (title: string, message: string) =>
  renderDocument(
    title,
    `<div class="card"><div class="sheet"><h1>${escapeHtml(title)}</h1><p class="prose">${escapeHtml(message)}</p></div></div>`,
  );
