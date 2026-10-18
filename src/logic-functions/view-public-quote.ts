import { defineLogicFunction } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { VIEW_PUBLIC_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { QuoteStatus } from 'src/objects/quote.object';
import { findQuoteByPublicToken } from 'src/utils/public-quote-data';
import { renderQuotePage } from 'src/utils/public-quote-page';
import {
  htmlResponse,
  quoteNotFoundResponse,
  quoteUnavailableResponse,
} from 'src/utils/public-quote-responses';
import { getPublicPageState } from 'src/utils/public-quote-state';
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

  return htmlResponse(
    renderQuotePage({
      quote,
      acceptActionUrl: `./${token}/accept`,
      autoPrint: event.queryStringParameters?.print === '1',
      isExpired: quote.status === QuoteStatus.SENT && isQuoteExpired(quote.expiresAt, new Date()),
    }),
  );
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
