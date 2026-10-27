import { defineLogicFunction } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { BILLING_DONE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { renderBillingDonePage } from 'src/utils/billing-done-page';
import { htmlResponse } from 'src/utils/public-quote-responses';
import { BILLING_DONE_ROUTE } from 'src/utils/public-quote-token';

// Where Dodo Payments sends the member back after checkout or the customer portal.
export default defineLogicFunction({
  universalIdentifier: BILLING_DONE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'billing-done',
  description: 'Page shown after checkout or the customer portal',
  timeoutSeconds: 10,
  handler: (event: RoutePayload) =>
    htmlResponse(renderBillingDonePage(event.queryStringParameters?.status)),
  httpRouteTriggerSettings: {
    path: BILLING_DONE_ROUTE,
    httpMethod: 'GET',
    isAuthRequired: false,
  },
});
