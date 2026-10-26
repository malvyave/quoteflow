import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { describe, expect, it } from 'vitest';

import { OPPORTUNITY_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

describe('OPPORTUNITY_OBJECT_UNIVERSAL_IDENTIFIER', () => {
  it('matches the SDK, so the copy kept for logic functions never drifts', () => {
    expect(OPPORTUNITY_OBJECT_UNIVERSAL_IDENTIFIER).toBe(
      STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
    );
  });
});
