import {
  definePageLayoutTab,
  PageLayoutTabLayoutMode,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  OPPORTUNITY_QUOTE_TAB_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_QUOTE_WIDGET_UNIVERSAL_IDENTIFIER,
  QUOTE_EDITOR_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Adds a "Quote" tab to every opportunity's record page.
export default definePageLayoutTab({
  universalIdentifier: OPPORTUNITY_QUOTE_TAB_UNIVERSAL_IDENTIFIER,
  pageLayoutUniversalIdentifier:
    STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.opportunityRecordPage.universalIdentifier,
  title: 'Quote',
  position: 55,
  icon: 'IconFileInvoice',
  layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
  widgets: [
    {
      universalIdentifier: OPPORTUNITY_QUOTE_WIDGET_UNIVERSAL_IDENTIFIER,
      title: 'Quote',
      type: 'FRONT_COMPONENT',
      configuration: {
        configurationType: 'FRONT_COMPONENT',
        frontComponentUniversalIdentifier: QUOTE_EDITOR_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
      },
    },
  ],
});
