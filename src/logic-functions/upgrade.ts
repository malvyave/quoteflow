import { defineLogicFunction } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';

import { UPGRADE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { StripeError } from 'src/utils/billing';
import {
  functionsBaseUrl,
  getBillingConfig,
  getEntitlement,
  getStripe,
  getWorkspaceId,
} from 'src/utils/billing-server';
import { BILLING_DONE_ROUTE, QUOTE_ACTIONS_ROUTE_PREFIX } from 'src/utils/public-quote-token';

// Returns where to send the member: Stripe Checkout to subscribe, or the billing portal to
// manage an existing subscription.
const handler = async () => {
  const { enabled, priceId } = getBillingConfig();

  if (!enabled) {
    return new Response({ error: 'Billing is not set up for this Twenty server.' }, { status: 409 });
  }

  const returnUrl = `${functionsBaseUrl()}${BILLING_DONE_ROUTE}`;
  const stripe = getStripe();

  try {
    const entitlement = await getEntitlement({ refresh: true });

    if (entitlement.isPaid && entitlement.customerId) {
      return {
        kind: 'portal',
        url: await stripe.createPortalSession({ customerId: entitlement.customerId, returnUrl }),
      };
    }

    if (!priceId) {
      return new Response({ error: 'Billing is missing a Stripe price.' }, { status: 500 });
    }

    return {
      kind: 'checkout',
      url: await stripe.createCheckoutSession({
        priceId,
        workspaceId: await getWorkspaceId(),
        successUrl: returnUrl,
        cancelUrl: returnUrl,
      }),
    };
  } catch (error) {
    if (error instanceof StripeError) {
      console.error('Stripe rejected the upgrade request.', error);

      return new Response({ error: 'Could not reach billing. Please try again.' }, { status: 502 });
    }

    throw error;
  }
};

export default defineLogicFunction({
  universalIdentifier: UPGRADE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'upgrade',
  description: 'Starts a Stripe checkout for the paid plan, or opens the billing portal',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: `${QUOTE_ACTIONS_ROUTE_PREFIX}/upgrade`,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
