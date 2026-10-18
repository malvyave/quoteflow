import { defineLogicFunction } from 'twenty-sdk/define';

import { PLAN_STATUS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { getPlanStatus } from 'src/utils/billing-server';
import { QUOTE_ACTIONS_ROUTE_PREFIX } from 'src/utils/public-quote-token';

export default defineLogicFunction({
  universalIdentifier: PLAN_STATUS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'plan-status',
  description: 'Reports the workspace plan and how many active quotes it has',
  timeoutSeconds: 30,
  handler: () => getPlanStatus(),
  httpRouteTriggerSettings: {
    path: `${QUOTE_ACTIONS_ROUTE_PREFIX}/plan`,
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
