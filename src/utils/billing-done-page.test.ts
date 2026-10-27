import { describe, expect, it } from 'vitest';

import { renderBillingDonePage } from 'src/utils/billing-done-page';

describe('renderBillingDonePage', () => {
  it('says the payment did not go through when Dodo reports a failed checkout', () => {
    for (const status of ['failed', 'cancelled', 'expired', 'FAILED']) {
      const html = renderBillingDonePage(status);

      expect(html).toContain('Payment did not go through');
      expect(html).toContain('You have not been charged.');
      expect(html).not.toContain('All set');
    }
  });

  it('confirms a successful or still-processing checkout', () => {
    for (const status of ['active', 'succeeded', 'processing']) {
      expect(renderBillingDonePage(status)).toContain('All set');
    }
  });

  it('confirms a return from the customer portal, which sends no status', () => {
    expect(renderBillingDonePage(undefined)).toContain('All set');
    expect(renderBillingDonePage('')).toContain('All set');
  });
});
