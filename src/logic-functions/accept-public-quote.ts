import { defineLogicFunction } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { ACCEPT_PUBLIC_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { QuoteStatus } from 'src/objects/quote.object';
import { acceptQuote, findQuoteByPublicToken } from 'src/utils/public-quote-data';
import { renderMessagePage, renderQuotePage } from 'src/utils/public-quote-page';
import { htmlResponse, quoteNotFoundResponse } from 'src/utils/public-quote-responses';
import { isValidPublicToken, PUBLIC_QUOTE_ROUTE_PREFIX } from 'src/utils/public-quote-token';

const handler = async (event: RoutePayload) => {
  const token = event.pathParameters?.token;

  if (!isValidPublicToken(token)) {
    return quoteNotFoundResponse();
  }

  const quote = await findQuoteByPublicToken(token);

  if (!quote || quote.status === QuoteStatus.DRAFT) {
    return quoteNotFoundResponse();
  }

  // Submitting twice (double click, refresh) just shows the accepted quote again.
  if (quote.status === QuoteStatus.ACCEPTED) {
    return htmlResponse(renderQuotePage({ quote, acceptActionUrl: '' }));
  }

  if (quote.status !== QuoteStatus.SENT) {
    return htmlResponse(
      renderMessagePage(
        'Quote not available',
        'This quote can no longer be accepted. Please contact the sender.',
      ),
      409,
    );
  }

  const accepted = await acceptQuote(quote);

  return htmlResponse(renderQuotePage({ quote: accepted, acceptActionUrl: '' }));
};

export default defineLogicFunction({
  universalIdentifier: ACCEPT_PUBLIC_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'accept-public-quote',
  description: 'Accepts a sent quote from its public link and marks the opportunity won',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: `${PUBLIC_QUOTE_ROUTE_PREFIX}/:token/accept`,
    httpMethod: 'POST',
    isAuthRequired: false,
  },
});
