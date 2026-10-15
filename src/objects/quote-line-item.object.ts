import { defineObject, FieldType, OnDeleteAction, RelationType } from 'twenty-sdk/define';

import {
  QUOTE_LINE_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_LINE_ITEM_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_LINE_ITEM_QUOTE_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_LINE_ITEM_UNIT_PRICE_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_LINE_ITEMS_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The built-in `name` field holds the line item's description.
export default defineObject({
  universalIdentifier: QUOTE_LINE_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'quoteLineItem',
  namePlural: 'quoteLineItems',
  labelSingular: 'Quote Line Item',
  labelPlural: 'Quote Line Items',
  description: 'A single priced line on a quote',
  icon: 'IconListDetails',
  fields: [
    {
      universalIdentifier: QUOTE_LINE_ITEM_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'quantity',
      type: FieldType.NUMBER,
      label: 'Quantity',
      icon: 'IconHash',
      isNullable: false,
      defaultValue: 1,
      universalSettings: { dataType: 'float', decimals: 2 },
    },
    {
      universalIdentifier: QUOTE_LINE_ITEM_UNIT_PRICE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'unitPrice',
      type: FieldType.CURRENCY,
      label: 'Unit price',
      icon: 'IconCurrencyDollar',
    },
    {
      universalIdentifier: QUOTE_LINE_ITEM_QUOTE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'quote',
      type: FieldType.RELATION,
      label: 'Quote',
      icon: 'IconFileInvoice',
      relationTargetObjectMetadataUniversalIdentifier: QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier: QUOTE_LINE_ITEMS_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'quoteId',
      },
    },
  ],
});
