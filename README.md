# QuoteFlowin for Twenty

QuoteFlowin is the quotation app for Twenty CRM. Build itemized quotes on your Twenty deals, send your client a link, and when they accept, the deal is marked won with the right amount.

Website: [quoteflowin.com](https://quoteflowin.com) · Guides: [create quotes in Twenty](https://quoteflowin.com/twenty-crm-quotes.html), [send and get accepted](https://quoteflowin.com/send-quote-twenty-crm.html), [quoting options compared](https://quoteflowin.com/twenty-crm-quoting-options.html)

QuoteFlowin is an independent app by Anudeep Kaur. It is not made by or affiliated with Twenty.

## Getting started

1. Install QuoteFlowin from the [install page](https://app.twenty.com/settings/applications/available/6fc1a9b8-000e-423a-a356-62a50ae7f81c) and click **Authorize**. Your free trial starts right away.
2. In **Settings → Applications → QuoteFlowin**, add your company details: name, logo, address, tax ID, payment instructions and brand color. They all appear on your quotes.
3. Open a deal, go to the new **Quote** tab, add line items and click **Next: Review & share**.
4. Click **Send quote**. You get a private link and a ready-written email to send from your own mailbox.
5. Your client opens the link (no account needed) and accepts with their name, or declines. On acceptance, the deal moves to your won stage with its amount set to the quote total.

A step-by-step guide is at [quoteflowin.com/docs](https://quoteflowin.com/docs.html).

## Features

- Line items with live subtotal, discount, tax and total, in the deal's currency, with a live preview of what your client sees.
- Branded quotes with your logo, color, contact details, tax ID and payment instructions, addressed to the deal's company and contact.
- Sequential quote numbers, valid-until dates, a message to the client and default terms.
- A clean client page that prints to a tidy PDF.
- See when the client first opened the quote. Sent, viewed, accepted and declined appear on the deal's timeline.
- Withdraw a sent quote to edit it, or revise and resend a declined one.
- A **By status** board of all quotes, with totals per column.
- Only one quote per deal can be accepted; other open quotes are marked superseded.

## Pricing

One flat fee per workspace, not per user. No other paid services are needed.

| Plan | Price | What you get |
| --- | --- | --- |
| **Free trial** | $0 | 14 days or 10 quotes sent, whichever comes first. No card needed. |
| **Monthly** | $12 a month | Unlimited quotes. Cancel anytime. |
| **Annual** | $108 a year ($9 a month) | Unlimited quotes. 14-day refund window. |
| **Lifetime** | $139 once | Unlimited quotes. First 75 workspaces only. Non-refundable. |

Choose a plan from the **Quote** tab. When the trial ends, your quotes and the links you sent keep working; sending new quotes needs a plan. Payments go through Dodo Payments. QuoteFlowin is free on self-hosted Twenty. See the [Terms](https://quoteflowin.com/terms.html) and [Refund Policy](https://quoteflowin.com/refund.html).

## Permissions

QuoteFlowin reads and writes its own **Quotes** and **Quote line items**. It reads **Companies** and **People** to address the quote, reads **Opportunities** and updates their stage and amount when a quote is accepted, and adds quote events to the **Timeline**. It cannot see notes, emails or any other records, and in the Quote tab it never does more than the signed-in member is allowed to.

## Your data

- Quotes and client details stay in your Twenty workspace, under its permissions and backups. They are never copied elsewhere, and you can delete them in Twenty at any time.
- On Twenty Cloud, billing sends Dodo Payments your workspace ID and, when you open checkout, your name and email. No quote data and no AI services are involved.
- Billing records are kept as long as tax law requires; other billing data is deleted within 90 days of your plan ending. Email info@quoteflowin.com to have it deleted sooner.
- Client links use a long random secret, are hidden from search engines, and stop working when a quote is withdrawn.

Details are in the [Privacy Policy](https://quoteflowin.com/privacy.html).

## Limitations

- Discount and tax apply to the whole quote, not to single lines.
- QuoteFlowin writes the email to your client but does not send it: it opens in your own email app.
- No e-signature or online payment of quotes yet.
- On self-hosted Twenty, your server must be reachable from the internet for clients to open quote links.

## Support

Email [info@quoteflowin.com](mailto:info@quoteflowin.com) or open an issue on [GitHub](https://github.com/malvyave/quoteflow/issues). [MIT licensed](https://github.com/malvyave/quoteflow/blob/main/LICENSE).
