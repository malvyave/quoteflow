import { AggregateOperations, defineView, ViewType } from 'twenty-sdk/define';

import {
  QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_OPPORTUNITY_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_SENT_AT_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTES_BY_STATUS_VIEW_ACCEPTED_GROUP_UNIVERSAL_IDENTIFIER,
  QUOTES_BY_STATUS_VIEW_DECLINED_GROUP_UNIVERSAL_IDENTIFIER,
  QUOTES_BY_STATUS_VIEW_DRAFT_GROUP_UNIVERSAL_IDENTIFIER,
  QUOTES_BY_STATUS_VIEW_OPPORTUNITY_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTES_BY_STATUS_VIEW_SENT_AT_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTES_BY_STATUS_VIEW_SENT_GROUP_UNIVERSAL_IDENTIFIER,
  QUOTES_BY_STATUS_VIEW_SUPERSEDED_GROUP_UNIVERSAL_IDENTIFIER,
  QUOTES_BY_STATUS_VIEW_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTES_BY_STATUS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { QuoteStatus } from 'src/objects/quote.object';

// A board of quotes by status. Status is set by the app, so cards show where quotes stand rather
// than being dragged; the deal on each card opens the deal, where the Quote tab edits the quote.
export default defineView({
  universalIdentifier: QUOTES_BY_STATUS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'By status',
  objectUniversalIdentifier: QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.KANBAN,
  icon: 'IconLayoutKanban',
  position: 1,
  mainGroupByFieldMetadataUniversalIdentifier: QUOTE_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
  kanbanAggregateOperation: AggregateOperations.SUM,
  kanbanAggregateOperationFieldMetadataUniversalIdentifier: QUOTE_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: QUOTES_BY_STATUS_VIEW_OPPORTUNITY_FIELD_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: QUOTE_OPPORTUNITY_FIELD_UNIVERSAL_IDENTIFIER,
      position: 0,
      isVisible: true,
    },
    {
      universalIdentifier: QUOTES_BY_STATUS_VIEW_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: QUOTE_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
      position: 1,
      isVisible: true,
    },
    {
      universalIdentifier: QUOTES_BY_STATUS_VIEW_SENT_AT_FIELD_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: QUOTE_SENT_AT_FIELD_UNIVERSAL_IDENTIFIER,
      position: 2,
      isVisible: true,
    },
  ],
  groups: [
    { universalIdentifier: QUOTES_BY_STATUS_VIEW_DRAFT_GROUP_UNIVERSAL_IDENTIFIER, fieldValue: QuoteStatus.DRAFT, position: 0 },
    { universalIdentifier: QUOTES_BY_STATUS_VIEW_SENT_GROUP_UNIVERSAL_IDENTIFIER, fieldValue: QuoteStatus.SENT, position: 1 },
    {
      universalIdentifier: QUOTES_BY_STATUS_VIEW_ACCEPTED_GROUP_UNIVERSAL_IDENTIFIER,
      fieldValue: QuoteStatus.ACCEPTED,
      position: 2,
    },
    {
      universalIdentifier: QUOTES_BY_STATUS_VIEW_DECLINED_GROUP_UNIVERSAL_IDENTIFIER,
      fieldValue: QuoteStatus.DECLINED,
      position: 3,
    },
    {
      universalIdentifier: QUOTES_BY_STATUS_VIEW_SUPERSEDED_GROUP_UNIVERSAL_IDENTIFIER,
      fieldValue: QuoteStatus.SUPERSEDED,
      position: 4,
    },
  ],
});
