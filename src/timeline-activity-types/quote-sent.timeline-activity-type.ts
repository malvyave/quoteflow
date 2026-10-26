import { defineTimelineActivityType } from 'twenty-sdk/define';

import { QUOTE_SENT_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineTimelineActivityType({
  universalIdentifier: QUOTE_SENT_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
  name: 'quoteSent',
  label: 'Quote sent',
  icon: 'IconSend',
});
