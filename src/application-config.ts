import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  BRAND_COLOR_VARIABLE_UNIVERSAL_IDENTIFIER,
  DEFAULT_MESSAGE_VARIABLE_UNIVERSAL_IDENTIFIER,
  DEFAULT_TERMS_VARIABLE_UNIVERSAL_IDENTIFIER,
  DEFAULT_WON_STAGE,
  PAYMENT_INSTRUCTIONS_VARIABLE_UNIVERSAL_IDENTIFIER,
  SELLER_ADDRESS_VARIABLE_UNIVERSAL_IDENTIFIER,
  SELLER_EMAIL_VARIABLE_UNIVERSAL_IDENTIFIER,
  SELLER_LOGO_URL_VARIABLE_UNIVERSAL_IDENTIFIER,
  SELLER_NAME_VARIABLE_UNIVERSAL_IDENTIFIER,
  SELLER_PHONE_VARIABLE_UNIVERSAL_IDENTIFIER,
  SELLER_TAX_ID_VARIABLE_UNIVERSAL_IDENTIFIER,
  SELLER_WEBSITE_VARIABLE_UNIVERSAL_IDENTIFIER,
  WON_STAGE_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  // Marketplace listing. The About tab uses README.md.
  category: 'Sales',
  logo: 'public/logo.png',
  galleryImages: ['public/screenshot-editor.png', 'public/screenshot-client.png'],
  websiteUrl: 'https://github.com/anudeepkaur3/quoteflow',
  issueReportUrl: 'https://github.com/anudeepkaur3/quoteflow/issues',
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
    SELLER_ADDRESS: {
      universalIdentifier: SELLER_ADDRESS_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Seller address',
      description:
        'Your business address, shown in the quote footer. Use commas to separate lines.',
      value: '',
      isSecret: false,
    },
    SELLER_EMAIL: {
      universalIdentifier: SELLER_EMAIL_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Seller email',
      description:
        'Contact email shown in the quote footer.',
      value: '',
      isSecret: false,
    },
    SELLER_PHONE: {
      universalIdentifier: SELLER_PHONE_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Seller phone',
      description:
        'Contact phone number shown in the quote footer.',
      value: '',
      isSecret: false,
    },
    SELLER_WEBSITE: {
      universalIdentifier: SELLER_WEBSITE_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Seller website',
      description:
        'Website shown in the quote footer, for example example.com.',
      value: '',
      isSecret: false,
    },
    SELLER_TAX_ID: {
      universalIdentifier: SELLER_TAX_ID_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Tax ID',
      description:
        'Tax registration shown on quotes, for example "GSTIN 29ABCDE1234F1Z5" or "VAT GB123456789".',
      value: '',
      isSecret: false,
    },
    PAYMENT_INSTRUCTIONS: {
      universalIdentifier: PAYMENT_INSTRUCTIONS_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Payment instructions',
      description:
        'Optional. How to pay, for example bank or UPI details, shown on every quote. Use | to start a new line.',
      value: '',
      isSecret: false,
    },
    BRAND_COLOR: {
      universalIdentifier: BRAND_COLOR_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Brand color',
      description:
        'Accent color for quotes as a hex code, for example #1961ED. Leave empty for the default blue.',
      value: '',
      isSecret: false,
    },
    DEFAULT_MESSAGE: {
      universalIdentifier: DEFAULT_MESSAGE_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Default message',
      description:
        'Message to the client that new quotes start with. It can be changed on each quote.',
      value: '',
      isSecret: false,
    },
    DEFAULT_TERMS: {
      universalIdentifier: DEFAULT_TERMS_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Default terms',
      description:
        'Terms that new quotes start with. They can be changed on each quote.',
      value: '',
      isSecret: false,
    },
  },
  // Set once per Twenty server by the app owner. Without an API key billing is off and there
  // is no quote limit (self-hosted servers and local development).
  serverVariables: {
    DODO_API_KEY: {
      description:
        'Dodo Payments API key. Turns on the free trial and paid plans. Needs read and write access to Customers, Subscriptions, Payments and Checkout.',
      isSecret: true,
    },
    DODO_MONTHLY_PRODUCT_ID: {
      description: 'Dodo Payments product ID (pdt_…) of the Monthly plan: a $12 per month subscription.',
      isSecret: false,
    },
    DODO_ANNUAL_PRODUCT_ID: {
      description: 'Dodo Payments product ID (pdt_…) of the Annual plan: a $108 per year subscription.',
      isSecret: false,
    },
    DODO_LIFETIME_PRODUCT_ID: {
      description:
        'Dodo Payments product ID (pdt_…) of the Lifetime plan: a $139 one-time payment, limited to 75 workspaces.',
      isSecret: false,
    },
    DODO_MODE: {
      description:
        '"test" or "live". Must match the API key. Defaults to test, so a missing value never charges real cards.',
      isSecret: false,
    },
  },
});
