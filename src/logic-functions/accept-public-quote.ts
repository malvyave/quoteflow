import { defineLogicFunction } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { ACCEPT_PUBLIC_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  acceptQuote,
  findQuoteByPublicToken,
  hasOtherAcceptedQuote,
} from 'src/utils/public-quote-data';
import { renderMessagePage, renderQuotePage } from 'src/utils/public-quote-page';
import {
  htmlResponse,
  quoteNotFoundResponse,
  quoteUnavailableResponse,
} from 'src/utils/public-quote-responses';
import { decideAcceptance, getPublicPageState } from 'src/utils/public-quote-state';
import { isValidPublicToken, PUBLIC_QUOTE_ROUTE_PREFIX } from 'src/utils/public-quote-token';
import { isQuoteExpired } from 'src/utils/quote-details';

const handler = async (event: RoutePayload) => {
  const token = event.pathParameters?.token;

  if (!isValidPublicToken(token)) {
    return quoteNotFoundResponse();
  }

  const quote = await findQuoteByPublicToken(token);

  if (!quote) {
    return quoteNotFoundResponse();
  }

  const state = getPublicPageState(quote.status);

  if (state !== 'quote') {
    return quoteUnavailableResponse(state);
  }

  const isExpired = isQuoteExpired(quote.expiresAt, new Date());
  const decision = decideAcceptance({
    status: quote.status,
    hasOtherAcceptedQuote: await hasOtherAcceptedQuote(quote),
    isExpired,
  });

  if (decision === 'expired') {
    return htmlResponse(renderQuotePage({ quote, acceptActionUrl: '', isExpired }), 410);
  }

  // Submitting twice (double click, refresh) just shows the accepted quote again.
  if (decision === 'already-accepted') {
    return htmlResponse(renderQuotePage({ quote, acceptActionUrl: '' }));
  }

  if (decision === 'unavailable') {
    return htmlResponse(
      renderMessagePage(
        'Quote not available',
        'Another quote for this deal has already been accepted. Please contact the sender.',
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
