import { defineLogicFunction } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { WITHDRAW_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  QUOTE_ACTIONS_ROUTE_PREFIX,
  runQuoteAction,
  withdrawQuoteAction,
} from 'src/utils/quote-status-actions';

export default defineLogicFunction({
  universalIdentifier: WITHDRAW_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'withdraw-quote',
  description: 'Moves a sent quote back to draft and invalidates its public link',
  timeoutSeconds: 30,
  handler: (event: RoutePayload) => runQuoteAction(event, withdrawQuoteAction),
  httpRouteTriggerSettings: {
    path: `${QUOTE_ACTIONS_ROUTE_PREFIX}/withdraw`,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
