import { defineLogicFunction } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { DECLINE_PUBLIC_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { QuoteStatus } from 'src/objects/quote.object';
import { declineQuote, findQuoteByPublicToken } from 'src/utils/public-quote-data';
import { readFormField } from 'src/utils/public-quote-form';
import { REASON_MAX_LENGTH, renderMessagePage, renderQuotePage } from 'src/utils/public-quote-page';
import {
  htmlResponse,
  quoteNotFoundResponse,
  quoteUnavailableResponse,
} from 'src/utils/public-quote-responses';
import { getPublicPageState } from 'src/utils/public-quote-state';
import { isValidPublicToken, PUBLIC_QUOTE_ROUTE_PREFIX } from 'src/utils/public-quote-token';

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

  // An accepted quote stays accepted; declining it now would undo a won deal.
  if (quote.status !== QuoteStatus.SENT) {
    return htmlResponse(renderQuotePage({ quote, acceptActionUrl: '' }), 409);
  }

  await declineQuote(quote, readFormField(event, 'declineReason', REASON_MAX_LENGTH));

  const sender = quote.seller.name ?? 'the sender';

  return htmlResponse(
    renderMessagePage('Quote declined', `Thanks for letting us know. We have told ${sender}.`),
  );
};

export default defineLogicFunction({
  universalIdentifier: DECLINE_PUBLIC_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'decline-public-quote',
  description: 'Declines a sent quote from its public link, with an optional reason',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: `${PUBLIC_QUOTE_ROUTE_PREFIX}/:token/decline`,
    httpMethod: 'POST',
    isAuthRequired: false,
  },
});
