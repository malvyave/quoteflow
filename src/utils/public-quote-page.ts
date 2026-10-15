import { computeQuoteTotals, formatMoney } from 'src/utils/quote-totals';

export type PublicQuote = {
  reference: string;
  name: string;
  status: string;
  currencyCode: string;
  discountPercent: number;
  taxPercent: number;
  sentAt: string | null;
  acceptedAt: string | null;
  companyName: string | null;
  lineItems: { name: string; quantity: number; unitPriceMicros: number }[];
};

// A short, stable label for the quote, e.g. Q-B1AE2A9A (sequential numbering is planned for v2).
export const toQuoteReference = (quoteId: string) => `Q-${quoteId.slice(0, 8).toUpperCase()}`;

// Everything a workspace member typed goes through this before reaching the page.
export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);

const STYLES = `
  :root { color-scheme: light dark; --bg: #f6f6f6; --card: #fff; --text: #1f1f1f; --muted: #6b6b6b;
    --border: #e6e6e6; --accent: #1961ed; --success: #1f8a4c; }
  @media (prefers-color-scheme: dark) { :root { --bg: #141414; --card: #1d1d1d; --text: #ebebeb;
    --muted: #9a9a9a; --border: #333; --accent: #5a8dff; --success: #4cc27f; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  main { max-width: 720px; margin: 40px auto; padding: 0 16px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: var(--muted); margin: 0 0 24px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-weight: 500; color: var(--muted); font-size: 13px; padding: 8px 0;
    border-bottom: 1px solid var(--border); }
  td { padding: 12px 0; border-bottom: 1px solid var(--border); vertical-align: top; }
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
  button.secondary { background: transparent; color: var(--text); border: 1px solid var(--border);
    padding: 8px 16px; font-weight: 500; font-size: 14px; }
  .notice { margin-top: 32px; padding: 12px 16px; border-radius: 8px; border: 1px solid var(--success);
    color: var(--success); text-align: center; font-weight: 500; }
  footer { text-align: center; color: var(--muted); font-size: 12px; margin-top: 16px; }
  .print-only { display: none; }
  @page { margin: 16mm; }
  @media print {
    :root { --bg: #fff; --card: #fff; --text: #111; --muted: #555; --border: #ddd; --success: #1f8a4c; }
    body { font-size: 12pt; }
    main { max-width: none; margin: 0; padding: 0; }
    .card { border: 0; border-radius: 0; padding: 0; }
    tr { break-inside: avoid; }
    .toolbar, .actions, footer { display: none; }
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

export const renderQuotePage = ({
  quote,
  acceptActionUrl,
  autoPrint = false,
}: {
  quote: PublicQuote;
  acceptActionUrl: string;
  autoPrint?: boolean;
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
  ]
    .filter(Boolean)
    .join(' · ');

  const footer =
    quote.status === 'ACCEPTED'
      ? `<div class="notice">Accepted${quote.acceptedAt ? ` on ${formatDate(quote.acceptedAt)}` : ''}. Thank you!</div>`
      : `<form class="actions" method="post" action="${escapeHtml(acceptActionUrl)}">
          <button type="submit">Accept quote</button>
        </form>`;

  // The document title becomes the default PDF file name.
  return renderDocument(
    `${quote.name} (${quote.reference})`,
    `<div class="toolbar">
      <button type="button" class="secondary" onclick="window.print()">Download PDF</button>
    </div>
    <div class="card">
      <div class="eyebrow"><span>Quote</span><span>${escapeHtml(quote.reference)}</span></div>
      <h1>${escapeHtml(quote.name)}</h1>
      <p class="meta">${meta}</p>
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
      ${footer}
      <p class="print-only">Quote ${escapeHtml(quote.reference)} · Prepared with Twenty Quotes</p>
    </div>`,
    { autoPrint },
  );
};

export const renderMessagePage = (title: string, message: string) =>
  renderDocument(
    title,
    `<div class="card"><h1>${escapeHtml(title)}</h1><p class="meta">${escapeHtml(message)}</p></div>`,
  );
