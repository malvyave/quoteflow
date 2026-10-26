import { defineTimelineActivityType } from 'twenty-sdk/define';

import { QUOTE_VIEWED_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineTimelineActivityType({
  universalIdentifier: QUOTE_VIEWED_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
  name: 'quoteViewed',
  label: 'Quote viewed by client',
  icon: 'IconEye',
});
