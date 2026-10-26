import { defineTimelineActivityType } from 'twenty-sdk/define';

import { QUOTE_ACCEPTED_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineTimelineActivityType({
  universalIdentifier: QUOTE_ACCEPTED_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
  name: 'quoteAccepted',
  label: 'Quote accepted',
  icon: 'IconCircleCheck',
});
