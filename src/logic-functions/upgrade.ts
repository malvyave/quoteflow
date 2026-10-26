import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { UPGRADE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { DodoError, isPlan, LIFETIME_SEAT_LIMIT } from 'src/utils/billing';
import {
  functionsBaseUrl,
  getBillingConfig,
  getDodo,
  getEntitlement,
  getOrCreateCustomerId,
  getWorkspace,
  isLifetimeAvailable,
} from 'src/utils/billing-server';
import { BILLING_DONE_ROUTE, QUOTE_ACTIONS_ROUTE_PREFIX } from 'src/utils/public-quote-token';

// Returns where to send the member: a Dodo checkout for the plan they picked, or the customer
// portal when they already subscribe and want to manage it.
const handler = async (event: RoutePayload) => {
  const { enabled, productIds } = getBillingConfig();

  if (!enabled) {
    return new Response({ error: 'Billing is not set up for this Twenty server.' }, { status: 409 });
  }

  const requested = (event.body as { plan?: unknown } | null)?.plan;
  const returnUrl = `${functionsBaseUrl()}${BILLING_DONE_ROUTE}`;
  const dodo = getDodo();

  try {
    const entitlement = await getEntitlement({ refresh: true });

    if (entitlement.plan === 'lifetime') {
      return new Response({ error: 'This workspace already has the Lifetime plan.' }, { status: 409 });
    }

    if (entitlement.isPaid || requested === undefined) {
      const customerId = await getOrCreateCustomerId();

      return { kind: 'portal', url: await dodo.createPortalSession({ customerId, returnUrl }) };
    }

    if (!isPlan(requested)) {
      return new Response({ error: 'Choose Monthly, Annual or Lifetime.' }, { status: 400 });
    }

    const productId = productIds[requested];

    if (!productId) {
      return new Response({ error: 'This plan is not available yet.' }, { status: 409 });
    }

    if (requested === 'lifetime' && !(await isLifetimeAvailable())) {
      return new Response(
        { error: `Lifetime was limited to the first ${LIFETIME_SEAT_LIMIT} workspaces and is sold out.` },
        { status: 409 },
      );
    }

    const customerId = await getOrCreateCustomerId();

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
  description: 'Starts a Dodo Payments checkout for the chosen plan, or opens the customer portal',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: `${QUOTE_ACTIONS_ROUTE_PREFIX}/upgrade`,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
