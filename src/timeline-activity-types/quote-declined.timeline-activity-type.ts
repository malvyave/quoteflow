import { defineTimelineActivityType } from 'twenty-sdk/define';

import { QUOTE_DECLINED_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineTimelineActivityType({
  universalIdentifier: QUOTE_DECLINED_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
  name: 'quoteDeclined',
  label: 'Quote declined',
  icon: 'IconCircleX',
});
