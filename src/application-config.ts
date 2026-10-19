import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  DEFAULT_WON_STAGE,
  SELLER_LOGO_URL_VARIABLE_UNIVERSAL_IDENTIFIER,
  SELLER_NAME_VARIABLE_UNIVERSAL_IDENTIFIER,
  WON_STAGE_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  applicationVariables: {
    WON_STAGE: {
      universalIdentifier: WON_STAGE_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Stage for accepted deals',
      description:
        'Opportunity stage value set when a client accepts a quote. Change it if your pipeline renamed the default "Customer" stage. If the value does not exist, only the amount is updated.',
      value: DEFAULT_WON_STAGE,
      isSecret: false,
    },
    SELLER_NAME: {
      universalIdentifier: SELLER_NAME_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Seller name',
      description: 'Company name shown on quotes. Leave empty to use the workspace name.',
      value: '',
      isSecret: false,
    },
    SELLER_LOGO_URL: {
      universalIdentifier: SELLER_LOGO_URL_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Seller logo URL',
      description:
        'Public https link to a logo image shown on quotes. Leave empty to use the workspace logo, if any.',
      value: '',
      isSecret: false,
    },
  },
  // Set once per Twenty server by the app owner. Without an API key billing is off and there
  // is no quote limit (self-hosted servers and local development).
  serverVariables: {
    DODO_API_KEY: {
      description:
        'Dodo Payments API key. Turns on the free plan limit and paid upgrades. Needs write access to Customers, Subscriptions and Checkout.',
      isSecret: true,
    },
    DODO_PRODUCT_ID: {
      description: 'Dodo Payments product ID (pdt_…) of the monthly QuoteFlow subscription.',
      isSecret: false,
    },
    DODO_MODE: {
      description:
        '"test" or "live". Must match the API key. Defaults to test, so a missing value never charges real cards.',
      isSecret: false,
    },
  },
});
