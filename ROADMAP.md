# Roadmap

Product name: QuoteFlow for Twenty (design doc v4).

## v1 (MVP)

Scope from the design doc v3:

- Line-item editor with live totals, whole-quote discount and tax.
- Each quote uses one currency, taken from its opportunity's amount.
- Send Quote gives a public link for the user to copy. The app does not send email.
- Accepting a quote marks the opportunity Won (configurable stage) and sets its amount to the quote total.
- Printable / PDF view.
- Expiration date ("valid until"), message to client, terms.
- Two-step flow (Edit → Review & share) with a live preview of the client page beside the editor (design doc v4).
- Seller name and logo on the quote (workspace name, or the Seller name / Seller logo URL settings).
- Sequential quote numbers (Q-0001), assigned when a quote is first sent.
- Plans through Dodo Payments (merchant of record): 14-day trial with up to 10 quotes sent, then Monthly ($12), Annual ($108/year) or Lifetime ($139 once, first 75 workspaces).

Decisions:

- Discount and tax are set once per quote (not per line item). Tax is a percentage the user enters.
- Only one quote per opportunity can be accepted; the others become Superseded.

## v2 (post-launch, ordered by expected demand)

1. Decline button.
2. Per-line-item discounts.
3. Duplicate a quote, and a list of all quotes on a deal in the Quote tab.
4. Tax label ("GST", "VAT") and saved tax rate presets.
5. View tracking / notifications.
6. Product catalog.
7. Email from the app, e-signature, payments.

Not planned for v1: a longer multi-step wizard (two steps is the maximum).
