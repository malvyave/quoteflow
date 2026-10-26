import { createTimelineActivity } from 'twenty-sdk/logic-function';

import {
  OPPORTUNITY_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_ACCEPTED_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
  QUOTE_DECLINED_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
  QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_SENT_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
  QUOTE_VIEWED_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export type QuoteActivity = 'sent' | 'viewed' | 'accepted' | 'declined';

const ACTIVITY_TYPES: Record<QuoteActivity, string> = {
  sent: QUOTE_SENT_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
  viewed: QUOTE_VIEWED_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
  accepted: QUOTE_ACCEPTED_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
  declined: QUOTE_DECLINED_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
};

// Adds the event to the deal's timeline, linked to the quote. The timeline is a record of what
// happened, so a failure here is logged and never stops sending, viewing or accepting.
export const logQuoteActivity = async (
  activity: QuoteActivity,
  {
    quoteId,
    opportunityId,
    properties = {},
  }: { quoteId: string; opportunityId: string | null; properties?: Record<string, unknown> },
) => {
  if (!opportunityId) {
    return;
  }

  try {
    await createTimelineActivity({
      timelineActivityTypeUniversalIdentifier: ACTIVITY_TYPES[activity],
      targetObjectUniversalIdentifier: OPPORTUNITY_OBJECT_UNIVERSAL_IDENTIFIER,
      targetRecordId: opportunityId,
      linkedRecordId: quoteId,
      linkedObjectMetadataUniversalIdentifier: QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
      properties,
    });
  } catch (error) {
    console.warn(`Could not add "${activity}" to the deal's timeline.`, error);
  }
};
