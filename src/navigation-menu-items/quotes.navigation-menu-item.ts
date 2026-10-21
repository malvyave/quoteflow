import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Sidebar entry for the list of all quotes, with Twenty's own search, filters and sorting.
export default defineNavigationMenuItem({
  universalIdentifier: QUOTES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Quotes',
  icon: 'IconFileInvoice',
  position: -1,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
});
