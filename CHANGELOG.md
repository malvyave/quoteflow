# Changelog

All notable changes to this application are documented in this file.

## Unreleased

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
