import { renderMessagePage } from 'src/utils/public-quote-page';

// Dodo adds status to the return URL after checkout; the customer portal sends none.
const FAILED_STATUSES = new Set(['failed', 'cancelled', 'expired']);

export const renderBillingDonePage = (status: string | undefined) =>
  status && FAILED_STATUSES.has(status.toLowerCase())
    ? renderMessagePage(
        'Payment did not go through',
        'You have not been charged. Go back to Twenty and choose a plan again to retry with another card.',
      )
    : renderMessagePage(
        'All set',
        'You can close this tab and go back to Twenty. A new subscription can take up to a minute to show up in QuoteFlow.',
      );
