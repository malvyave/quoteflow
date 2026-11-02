# Changelog

All notable changes to this application are documented in this file.

## 1.0.1 — 2026-11-02

- First release published from GitHub with npm provenance, so the app can be claimed in the Twenty marketplace. No changes to the app.

## 1.0.0 — 2026-11-02

- Renamed the app to QuoteFlowin, to match quoteflowin.com: the name in Settings → Apps, "Sent with QuoteFlowin" on the client page and "Prepared with QuoteFlowin" on PDFs. The npm package is now `quoteflowin`; the app identifier is unchanged, so existing installs keep working.
- The Lifetime plan card says the purchase is non-refundable, matching the Refund Policy.
- The marketplace listing links to quoteflowin.com, its Terms of Service, and info@quoteflowin.com for support.
- New pricing: a 14-day free trial with up to 10 quotes sent, then Monthly ($12), Annual ($108 a year) or Lifetime ($139 once, limited to the first 75 workspaces). Choose a plan from the Quote tab. Replaces the free plan of 5 active quotes and the $19 plan.

## 0.2.0 — 2026-10-26

First public beta.

- Clients accept with their name ("Accepted by …" on the quote and PDF), or decline with an optional reason; declined quotes can be revised and resent.
- The Quote tab shows when the client first viewed the quote.
- Sent, viewed, accepted and declined appear on the deal's timeline.
- A "By status" board of quotes, with totals per column and a link to each deal.
- Every current world currency in the quote editor, with names, common currencies first.
- Email to client in Review & share: a ready-written, editable email with the quote number, total and link, which opens in your email app or copies to the clipboard.
- Redesigned quote document: logo and big "Quote" heading, a "Prepared for" block from the deal's company and contact, a seller footer with contact details and tax ID, payment instructions and a brand color.
- Default message and terms for new quotes.
- PDFs no longer include the browser's header and footer, which showed the quote's private link.
- A sent quote in the Quote tab updates by itself when the client accepts it.

- Renamed the app to QuoteFlow for Twenty (npm package `twenty-quoteflow`).
- Valid-until dates, buyer preview, message to client, terms, seller name and logo, and sequential quote numbers.
- Hardening: the app role only reaches quotes, line items, opportunities and companies; quote status and link fields can only be changed by the app; only one quote per deal can be accepted; configurable won stage.
- Printable PDF view of the client page.
- Send Quote, public client page and acceptance that marks the deal won.
- Line-item editor with live totals on the opportunity page.
- Quote and Quote Line Item objects linked to opportunities.

## 0.1.0

- Initial application scaffolded with `twenty app init`
