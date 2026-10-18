import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  DEFAULT_WON_STAGE,
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
  },
});
