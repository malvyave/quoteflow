import { defineLogicFunction } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { SEND_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  QUOTE_ACTIONS_ROUTE_PREFIX,
  runQuoteAction,
  sendQuoteAction,
} from 'src/utils/quote-status-actions';

export default defineLogicFunction({
  universalIdentifier: SEND_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'send-quote',
  description: 'Locks a draft quote and gives it a public link',
  timeoutSeconds: 30,
  handler: (event: RoutePayload) => runQuoteAction(event, sendQuoteAction),
  httpRouteTriggerSettings: {
    path: `${QUOTE_ACTIONS_ROUTE_PREFIX}/send`,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
