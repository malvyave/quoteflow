# QuoteFlowin for Twenty

Itemized quotes on your Twenty deals. Add line items, send your client a link, and when they accept, the deal is marked won with the right amount.

## Pricing

One flat fee per workspace, not per user.

| Plan | Price | What you get |
| --- | --- | --- |
| **Free trial** | $0 | 14 days, up to 10 quotes sent. No credit card. |
| **Monthly** | $12 per workspace per month | Unlimited quotes. Cancel anytime. |
| **Annual** | $108 per workspace per year ($9 a month) | Unlimited quotes. Save 25%. |
| **Lifetime** | $139 once | Unlimited quotes forever. Limited to the first 75 workspaces. Non-refundable. |

When the trial ends, you can still open and edit your quotes, and links you already sent keep working for your clients; sending new quotes needs a plan. Choose one from the plan bar in the Quote tab. Payments are processed by Dodo Payments. See the [Terms](https://quoteflowin.com/terms.html) and [Refund Policy](https://quoteflowin.com/refund.html).

QuoteFlowin on a self-hosted Twenty server is free: plans apply to Twenty Cloud.

Feedback is very welcome; see [Support](#support).

## How it works

1. Open a deal (opportunity) and go to the **Quote** tab.
2. **Step 1 · Edit.** Add line items with quantity and price, and set a discount, tax and how long the quote is valid. Add an optional message to your client and your terms. A live preview beside the editor shows exactly what your client will see as you type.
3. Click **Next: Review & share**. QuoteFlowin saves the quote and shows a summary next to the full preview.
4. **Step 2 · Review & share.** Click **Send quote**. You get a private link, and a ready-written email to your client with the quote number, total and link. Edit it if you like, then click **Open in email app** to send it from your own mailbox, or **Copy email** to paste it anywhere. The quote is locked while it is out.
5. Your client opens the link (no account needed). The Quote tab shows when they first viewed it. They can download it as a PDF.
6. Your client types their name and clicks **Accept quote**, or declines, optionally saying why.
7. Accepted: the quote is marked **Accepted** with the client's name, and the deal moves to your won stage with its amount set to the quote total. Declined: you see the reason and can **Revise and resend**.
8. Sent, viewed, accepted and declined also appear on the deal's **Timeline**.

## Features

- Line items with live subtotal, discount, tax and total.
- The quote uses the deal's currency.
- Valid-until dates. Expired quotes can no longer be accepted.
- Sequential quote numbers (Q-0001, Q-0002, …).
- Branded quotes: your logo, brand color, contact details, tax ID and payment instructions.
- The client's company, contact person and address in a "Prepared for" block, filled in from the deal.
- Default message and terms for new quotes.
- Clean client page with a layout for small screens, which prints to a tidy PDF without the browser's header and footer, so the private link never ends up in the file.
- Withdraw a sent quote to edit it; the old link stops working.
- See when the client first opened the quote. Your own clicks from the Quote tab do not count.
- Clients accept with their name, or decline with an optional reason.
- Quote events on the deal's timeline.
- A **By status** board in the Quotes list (Draft, Sent, Accepted, Declined, Superseded), with the total per column. Each card links to its deal.
- Only one quote per deal can be accepted. Other open quotes on the deal are marked **Superseded**, and their links explain that they were replaced.

## Settings

Find these under **Settings → Apps → QuoteFlowin → Variables**.

| Setting | What it does |
| --- | --- |
| Stage for accepted deals | The deal stage set when a client accepts. Defaults to `CUSTOMER`. If your pipeline does not have this stage, the deal amount is still updated and the stage is left as is. |
| Seller name | Company name shown on quotes. Leave empty to use your workspace name. |
| Seller logo URL | A public `https://` link to your logo. Leave empty to use your workspace logo, if you have one. |
| Seller address, email, phone, website | Contact details in the quote footer. Separate address lines with commas. |
| Tax ID | Your tax registration, for example a GSTIN or VAT number. |
| Payment instructions | Optional bank or UPI details. A vertical bar (`\|`) starts a new line, for example `Your Bank \| A/C 000000000000 \| IFSC XXXX0000000`. |
| Brand color | Accent color as a hex code, for example `#1961ED`. |
| Default message, Default terms | What new quotes start with. Each quote can still be changed. |

## What QuoteFlowin can access

QuoteFlowin only works with the records it needs:

- **Quotes and quote line items** (its own objects): read and write.
- **Opportunities**: read, and update the stage and amount when a quote is accepted.
- **Companies**: read the client's company name and address shown on the quote.
- **People**: read the deal's point of contact, to show their name and email on the quote.
- **Timeline activities**: add quote events (sent, viewed, accepted, declined) to the deal's timeline.

It has no access to notes, emails or any other records, and never changes companies or people. In the Quote tab it never does more than the signed-in member is allowed to do.

## Your data

Quotes are stored in your own Twenty workspace, next to your deals, and are covered by your workspace's backups and permissions. QuoteFlowin does not send them anywhere else. For billing on Twenty Cloud, only your workspace ID and, when you open checkout, your name and email go to Dodo Payments. See the [Privacy Policy](https://quoteflowin.com/privacy.html).

Client links contain a long random secret, are hidden from search engines, and stop working when a quote is withdrawn. Anyone who has a link can view and accept that quote, so share it only with your client.

## Current limitations

- Discount and tax apply to the whole quote, not to individual lines.
- QuoteFlowin writes the email but does not send it: it opens in your own email app, so replies come straight to you.
- No e-signature or online payment yet.
- The Quote tab shows the most recent quote on a deal. All of a deal's quotes are listed in its **Quotes** field.
- Self-hosted Twenty must be reachable from the internet for clients to open quote links.

## Support

Found a bug or have an idea? Open an issue on [GitHub](https://github.com/malvyave/quoteflow/issues).

## License

[MIT](LICENSE)

## Development

Setup instructions live in [SETUP.md](SETUP.md). The roadmap is in [ROADMAP.md](ROADMAP.md) and notable changes are in [CHANGELOG.md](CHANGELOG.md).
