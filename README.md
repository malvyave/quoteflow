# QuoteFlow for Twenty

Itemized quotes on your Twenty deals. Add line items, send your client a link, and when they accept, the deal is marked won with the right amount.

## How it works

1. Open a deal (opportunity) and go to the **Quote** tab.
2. Add line items with quantity and price. Set a discount, tax and how long the quote is valid. Totals update as you type.
3. Add an optional message to your client and your terms, then click **Preview as buyer** to check what they will see.
4. Click **Send quote**. You get a private link to share with your client by email or chat. The quote is locked while it is out.
5. Your client opens the link (no account needed), reviews the quote and clicks **Accept quote**. They can also download it as a PDF.
6. The quote is marked **Accepted**, and the deal moves to your won stage with its amount set to the quote total.

## Features

- Line items with live subtotal, discount, tax and total.
- The quote uses the deal's currency.
- Valid-until dates. Expired quotes can no longer be accepted.
- Sequential quote numbers (Q-0001, Q-0002, …).
- Your company name and logo on the quote.
- Clean client page with a layout for small screens, which prints to a tidy PDF.
- Withdraw a sent quote to edit it; the old link stops working.
- Only one quote per deal can be accepted. Other open quotes on the deal are marked **Superseded**, and their links explain that they were replaced.

## Settings

Find these under **Settings → Apps → QuoteFlow → Variables**.

| Setting | What it does |
| --- | --- |
| Stage for accepted deals | The deal stage set when a client accepts. Defaults to `CUSTOMER`. If your pipeline does not have this stage, the deal amount is still updated and the stage is left as is. |
| Seller name | Company name shown on quotes. Leave empty to use your workspace name. |
| Seller logo URL | A public `https://` link to your logo. Leave empty to use your workspace logo, if you have one. |

## What QuoteFlow can access

QuoteFlow only works with the records it needs:

- **Quotes and quote line items** (its own objects): read and write.
- **Opportunities**: read, and update the stage and amount when a quote is accepted.
- **Companies**: read the company name shown on the quote.

It has no access to people, notes, emails or any other records. In the Quote tab it never does more than the signed-in member is allowed to do.

## Your data

Quotes are stored in your own Twenty workspace, next to your deals, and are covered by your workspace's backups and permissions. QuoteFlow does not send your data anywhere else.

Client links contain a long random secret, are hidden from search engines, and stop working when a quote is withdrawn. Anyone who has a link can view and accept that quote, so share it only with your client.

## Current limitations

- Discount and tax apply to the whole quote, not to individual lines.
- Quotes are shared by link. QuoteFlow does not send emails.
- No e-signature or online payment yet.
- The Quote tab shows the most recent quote on a deal. All of a deal's quotes are listed in its **Quotes** field.
- Self-hosted Twenty must be reachable from the internet for clients to open quote links.

## Development

Setup instructions live in [SETUP.md](SETUP.md). The roadmap is in [ROADMAP.md](ROADMAP.md) and notable changes are in [CHANGELOG.md](CHANGELOG.md).
