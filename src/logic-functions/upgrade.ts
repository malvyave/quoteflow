import { defineLogicFunction } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';

import { UPGRADE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { DodoError } from 'src/utils/billing';
import {
  functionsBaseUrl,
  getBillingConfig,
  getDodo,
  getOrCreateCustomerId,
  getWorkspace,
} from 'src/utils/billing-server';
import { BILLING_DONE_ROUTE, QUOTE_ACTIONS_ROUTE_PREFIX } from 'src/utils/public-quote-token';

// Returns where to send the member: Dodo checkout to subscribe, or the customer portal to manage
// an existing subscription.
const handler = async () => {
  const { enabled, productId } = getBillingConfig();

  if (!enabled) {
    return new Response({ error: 'Billing is not set up for this Twenty server.' }, { status: 409 });
  }

  if (!productId) {
    return new Response({ error: 'Billing is missing a Dodo Payments product.' }, { status: 500 });
  }

  const returnUrl = `${functionsBaseUrl()}${BILLING_DONE_ROUTE}`;
  const dodo = getDodo();

  try {
    const customerId = await getOrCreateCustomerId();

    if (await dodo.hasPayingSubscription({ customerId, productId })) {
      return { kind: 'portal', url: await dodo.createPortalSession({ customerId, returnUrl }) };
    }

    return {
      kind: 'checkout',
      url: await dodo.createCheckout({
        productId,
        customerId,
        workspaceId: (await getWorkspace()).id,
        returnUrl,
      }),
    };
  } catch (error) {
    if (error instanceof DodoError) {
      console.error('Dodo Payments rejected the upgrade request.', error);

      return new Response({ error: 'Could not reach billing. Please try again.' }, { status: 502 });
    }

    throw error;
  }
};

export default defineLogicFunction({
  universalIdentifier: UPGRADE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'upgrade',
  description: 'Starts a Dodo Payments checkout for the paid plan, or opens the customer portal',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: `${QUOTE_ACTIONS_ROUTE_PREFIX}/upgrade`,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
