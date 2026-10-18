import { defineLogicFunction } from 'twenty-sdk/define';

import { BILLING_DONE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { renderMessagePage } from 'src/utils/public-quote-page';
import { htmlResponse } from 'src/utils/public-quote-responses';
import { BILLING_DONE_ROUTE } from 'src/utils/public-quote-token';

// Where Stripe sends the member back after checkout or the billing portal.
export default defineLogicFunction({
  universalIdentifier: BILLING_DONE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'billing-done',
  description: 'Page shown after Stripe checkout or the billing portal',
  timeoutSeconds: 10,
  handler: () =>
    htmlResponse(
      renderMessagePage(
        'All set',
        'You can close this tab and go back to Twenty. A new subscription can take up to a minute to show up in QuoteFlow.',
      ),
    ),
  httpRouteTriggerSettings: {
    path: BILLING_DONE_ROUTE,
    httpMethod: 'GET',
    isAuthRequired: false,
  },
});
