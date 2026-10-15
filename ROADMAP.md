# Roadmap

## v1 (MVP)

Scope from the design doc, plus:

- Each quote uses one currency, taken from its opportunity's amount.

Decisions:

- Discount and tax are set once per quote (not per line item). Tax is a percentage the user enters.
- "Send Quote" produces a public link for the user to copy. The app does not send email.
- Accepting a quote marks the opportunity Won and sets its amount to the quote total.

## v2 (in rough priority order)

1. Expiration date: the public page shows the quote as expired after it.
2. Quote numbers (Q-0001).
3. Workspace logo on the public page.
4. Per-line-item discounts.
5. Duplicate a quote (for revisions).
6. Tax label ("GST", "VAT", "Sales tax").
7. Saved tax rate presets.
8. Email the quote from the app.
9. Notify the user when the client views the quote.
10. Product catalog, approvals, e-signature, payments.
