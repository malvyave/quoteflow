import { computeQuoteTotals, formatMoney } from 'src/utils/quote-totals';

export type QuoteSeller = { name: string | null; logoUrl: string | null };

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
  companyName: string | null;
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
    --border: #e6e6e6; --accent: #1961ed; --success: #1f8a4c; --warning: #b35c00; }
  @media (prefers-color-scheme: dark) { :root { --bg: #141414; --card: #1d1d1d; --text: #ebebeb;
    --muted: #9a9a9a; --border: #333; --accent: #5a8dff; --success: #4cc27f; --warning: #f0a35e; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  main { max-width: 720px; margin: 40px auto; padding: 0 16px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 13px; font-weight: 600; color: var(--muted); margin: 32px 0 8px; text-transform: uppercase;
    letter-spacing: 0.06em; }
  .meta { color: var(--muted); margin: 0 0 24px; }
  .seller { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; font-weight: 600; font-size: 16px; }
  .seller img { max-height: 40px; max-width: 160px; object-fit: contain; }
  .prose { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0 0 24px; }
  .terms { white-space: pre-wrap; overflow-wrap: anywhere; color: var(--muted); font-size: 14px; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-weight: 500; color: var(--muted); font-size: 13px; padding: 8px 0;
    border-bottom: 1px solid var(--border); }
  td { padding: 12px 0; border-bottom: 1px solid var(--border); vertical-align: top; overflow-wrap: anywhere; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; padding-left: 16px; }
  .summary { margin: 16px 0 0 auto; width: min(100%, 280px); }
  .summary div { display: flex; justify-content: space-between; padding: 4px 0; font-variant-numeric: tabular-nums; }
  .summary .muted { color: var(--muted); }
  .summary .total { font-weight: 600; font-size: 17px; border-top: 1px solid var(--border); margin-top: 8px; padding-top: 12px; }
  .eyebrow { display: flex; justify-content: space-between; color: var(--muted); font-size: 12px;
    font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 12px; }
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
  .preview-banner { margin-bottom: 12px; padding: 8px 12px; border-radius: 8px; border: 1px dashed var(--border);
    color: var(--muted); font-size: 13px; text-align: center; }
  footer { text-align: center; color: var(--muted); font-size: 12px; margin-top: 16px; }
  .print-only { display: none; }
  @page { margin: 16mm; }
  @media print {
    :root { --bg: #fff; --card: #fff; --text: #111; --muted: #555; --border: #ddd; --success: #1f8a4c;
      --warning: #b35c00; }
    body { font-size: 12pt; }
    main { max-width: none; margin: 0; padding: 0; }
    .card { border: 0; border-radius: 0; padding: 0; }
    tr { break-inside: avoid; }
    .toolbar, .actions, .preview-banner, footer { display: none; }
    .print-only { display: block; margin-top: 32px; color: var(--muted); font-size: 9pt; }
  }
`;

// Opening the page with ?print=1 brings up the print dialog, where "Save as PDF" makes the file.
const AUTO_PRINT_SCRIPT = `<script>window.addEventListener('load', function () { window.print(); });</script>`;

const renderDocument = (title: string, content: string, { autoPrint = false } = {}) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
${autoPrint ? AUTO_PRINT_SCRIPT : ''}
</head>
<body><main>${content}<footer>Sent with Twenty Quotes</footer></main></body>
</html>`;

const renderSeller = (seller: QuoteSeller) => {
  if (!seller.name && !seller.logoUrl) {
    return '';
  }

  const logo = seller.logoUrl
    ? `<img src="${escapeHtml(seller.logoUrl)}" alt="${escapeHtml(seller.name ?? 'Logo')}">`
    : '';

  return `<div class="seller">${logo}${seller.name ? `<span>${escapeHtml(seller.name)}</span>` : ''}</div>`;
};

const renderFooter = ({
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

  const meta = [
    quote.companyName ? `For ${escapeHtml(quote.companyName)}` : null,
    quote.sentAt ? `Sent ${formatDate(quote.sentAt)}` : null,
    quote.expiresAt ? `Valid until ${formatDate(quote.expiresAt)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const message = quote.message?.trim();
  const terms = quote.terms?.trim();

  // The document title becomes the default PDF file name.
  return renderDocument(
    `${quote.name} (${quote.reference})`,
    `${isPreview ? '<div class="preview-banner">Preview — this is what your client will see</div>' : ''}
    <div class="toolbar">
      <button type="button" class="secondary" onclick="window.print()"${isPreview ? ' disabled' : ''}>Download PDF</button>
    </div>
    <div class="card">
      ${renderSeller(quote.seller)}
      <div class="eyebrow"><span>Quote</span><span>${escapeHtml(quote.reference)}</span></div>
      <h1>${escapeHtml(quote.name)}</h1>
      <p class="meta">${meta}</p>
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
      ${terms ? `<h2>Terms</h2><p class="terms">${escapeHtml(terms)}</p>` : ''}
      ${renderFooter({ quote, acceptActionUrl, isExpired, isPreview })}
      <p class="print-only">Quote ${escapeHtml(quote.reference)}${
        quote.seller.name ? ` · ${escapeHtml(quote.seller.name)}` : ''
      } · Prepared with Twenty Quotes</p>
    </div>`,
    { autoPrint },
  );
};

export const renderMessagePage = (title: string, message: string) =>
  renderDocument(
    title,
    `<div class="card"><h1>${escapeHtml(title)}</h1><p class="meta">${escapeHtml(message)}</p></div>`,
  );
