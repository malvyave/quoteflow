# Changelog

All notable changes to this application are documented in this file.

## Unreleased

- Renamed the app to QuoteFlow for Twenty (npm package `twenty-quoteflow`).
- Valid-until dates, buyer preview, message to client, terms, seller name and logo, and sequential quote numbers.
- Hardening: the app role only reaches quotes, line items, opportunities and companies; quote status and link fields can only be changed by the app; only one quote per deal can be accepted; configurable won stage.
- Printable PDF view of the client page.
- Send Quote, public client page and acceptance that marks the deal won.
- Line-item editor with live totals on the opportunity page.
- Quote and Quote Line Item objects linked to opportunities.

## 0.1.0

- Initial application scaffolded with `twenty app init`
