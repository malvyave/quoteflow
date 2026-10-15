import { defineLogicFunction } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { VIEW_PUBLIC_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { QuoteStatus } from 'src/objects/quote.object';
import { findQuoteByPublicToken } from 'src/utils/public-quote-data';
import { renderQuotePage } from 'src/utils/public-quote-page';
import { htmlResponse, quoteNotFoundResponse } from 'src/utils/public-quote-responses';
import { isValidPublicToken, PUBLIC_QUOTE_ROUTE_PREFIX } from 'src/utils/public-quote-token';

const handler = async (event: RoutePayload) => {
  const token = event.pathParameters?.token;

  if (!isValidPublicToken(token)) {
    return quoteNotFoundResponse();
  }

  const quote = await findQuoteByPublicToken(token);

  // A quote moved back to Draft keeps no public link; treat it as withdrawn.
  if (!quote || quote.status === QuoteStatus.DRAFT) {
    return quoteNotFoundResponse();
  }

  return htmlResponse(renderQuotePage({ quote, acceptActionUrl: `./${token}/accept` }));
};

export default defineLogicFunction({
  universalIdentifier: VIEW_PUBLIC_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'view-public-quote',
  description: 'Serves the client-facing quote page for a public quote link',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: `${PUBLIC_QUOTE_ROUTE_PREFIX}/:token`,
    httpMethod: 'GET',
    isAuthRequired: false,
  },
});
