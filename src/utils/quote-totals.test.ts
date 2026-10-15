import { describe, expect, it } from 'vitest';

import { computeQuoteTotals, formatMoney, majorToMicros } from 'src/utils/quote-totals';

const line = (quantity: number, unitPrice: number) => ({
  quantity,
  unitPriceMicros: majorToMicros(unitPrice),
});

describe('computeQuoteTotals', () => {
  it('matches the design doc example: $6,500, 10% discount, 18% tax = $6,903', () => {
    const totals = computeQuoteTotals({
      lines: [line(1, 4000), line(1, 2500)],
      discountPercent: 10,
      taxPercent: 18,
    });

    expect(totals.subtotalMicros).toBe(majorToMicros(6500));
    expect(totals.discountMicros).toBe(majorToMicros(650));
    expect(totals.taxMicros).toBe(majorToMicros(1053));
    expect(totals.totalMicros).toBe(majorToMicros(6903));
  });

  it('multiplies quantity by unit price, including fractional quantities', () => {
    const totals = computeQuoteTotals({
      lines: [line(3, 19.99), line(2.5, 120)],
      discountPercent: 0,
      taxPercent: 0,
    });

    expect(totals.lineTotalsMicros).toEqual([majorToMicros(59.97), majorToMicros(300)]);
    expect(totals.totalMicros).toBe(majorToMicros(359.97));
  });

  it('avoids floating point drift', () => {
    const totals = computeQuoteTotals({
      lines: [line(1, 0.1), line(1, 0.2)],
      discountPercent: 0,
      taxPercent: 0,
    });

    expect(totals.totalMicros).toBe(majorToMicros(0.3));
  });

  it('rounds discount and tax to the nearest cent', () => {
    const totals = computeQuoteTotals({
      lines: [line(1, 10.01)],
      discountPercent: 15,
      taxPercent: 7.25,
    });

    // discount 1.5015 -> 1.50; taxable 8.51; tax 0.616975 -> 0.62
    expect(totals.discountMicros).toBe(majorToMicros(1.5));
    expect(totals.taxMicros).toBe(majorToMicros(0.62));
    expect(totals.totalMicros).toBe(majorToMicros(9.13));
  });

  it('treats empty, negative or invalid input as zero and caps discount at 100%', () => {
    expect(computeQuoteTotals({ lines: [], discountPercent: 10, taxPercent: 18 }).totalMicros).toBe(
      0,
    );

    const totals = computeQuoteTotals({
      lines: [line(-2, 50), line(1, Number.NaN), line(1, 100)],
      discountPercent: 150,
      taxPercent: -5,
    });

    expect(totals.subtotalMicros).toBe(majorToMicros(100));
    expect(totals.totalMicros).toBe(0);
  });
});

describe('formatMoney', () => {
  it('formats with the currency code and falls back for unknown codes', () => {
    expect(formatMoney(majorToMicros(6903), 'USD')).toContain('6,903.00');
    expect(formatMoney(majorToMicros(5), 'NOT_A_CODE')).toBe('5.00 NOT_A_CODE');
  });
});
