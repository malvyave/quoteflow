import { defineLogicFunction } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { BILLING_DONE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { renderMessagePage } from 'src/utils/public-quote-page';
import { htmlResponse } from 'src/utils/public-quote-responses';
import { BILLING_DONE_ROUTE } from 'src/utils/public-quote-token';

// Dodo adds status to the return URL after checkout; the customer portal sends none.
const FAILED_STATUSES = new Set(['failed', 'cancelled', 'expired']);

// Where Dodo Payments sends the member back after checkout or the customer portal.
const handler = (event: RoutePayload) => {
  const status = event.queryStringParameters?.status?.toLowerCase();

  if (status && FAILED_STATUSES.has(status)) {
    return htmlResponse(
      renderMessagePage(
        'Payment did not go through',
        'You have not been charged. Go back to Twenty and choose a plan again to retry with another card.',
      ),
    );
  }

  return htmlResponse(
    renderMessagePage(
      'All set',
      'You can close this tab and go back to Twenty. A new subscription can take up to a minute to show up in QuoteFlow.',
    ),
  );
};

export default defineLogicFunction({
  universalIdentifier: BILLING_DONE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'billing-done',
  description: 'Page shown after checkout or the customer portal',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: BILLING_DONE_ROUTE,
    httpMethod: 'GET',
    isAuthRequired: false,
  },
});
