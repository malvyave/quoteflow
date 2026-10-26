import { describe, expect, it } from 'vitest';

import { buildCurrencyOptions, COMMON_CURRENCY_CODES } from 'src/utils/currencies';

describe('buildCurrencyOptions', () => {
  it('puts the common currencies first, with their names', () => {
    const { common } = buildCurrencyOptions('USD');

    expect(common.map((option) => option.code)).toEqual(COMMON_CURRENCY_CODES);
    expect(common[0]).toEqual({ code: 'USD', label: 'USD — US Dollar' });
    expect(common.find((option) => option.code === 'INR')?.label).toBe('INR — Indian Rupee');
  });

  it('offers every other current currency once, sorted', () => {
    const { common, others } = buildCurrencyOptions('USD');
    const codes = others.map((option) => option.code);

    expect(codes).toContain('BRL');
    expect(codes).toContain('ZAR');
    expect(codes).not.toContain('USD');
    expect(codes).toEqual([...codes].sort());
    expect(new Set([...common, ...others].map((option) => option.code)).size).toBe(
      common.length + others.length,
    );
    expect(common.length + others.length).toBeGreaterThan(150);
  });

  it('keeps a less common deal currency at the top', () => {
    const { common, others } = buildCurrencyOptions('BRL');

    expect(common[0]).toEqual({ code: 'BRL', label: 'BRL — Brazilian Real' });
    expect(others.map((option) => option.code)).not.toContain('BRL');
  });

  it('keeps an unknown currency code as it is', () => {
    expect(buildCurrencyOptions('XYZ1').common[0]).toEqual({ code: 'XYZ1', label: 'XYZ1' });
  });
});
