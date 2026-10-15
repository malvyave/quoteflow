// Twenty stores money as amountMicros (1 unit = 1,000,000 micros).
// All math here runs on whole cents so totals never drift from float error.
const MICROS_PER_CENT = 10_000;

export type QuoteLineInput = {
  quantity: number;
  unitPriceMicros: number;
};

export type QuoteTotals = {
  lineTotalsMicros: number[];
  subtotalMicros: number;
  discountMicros: number;
  taxMicros: number;
  totalMicros: number;
};

const toCents = (micros: number) => Math.round(micros / MICROS_PER_CENT);

const toMicros = (cents: number) => cents * MICROS_PER_CENT;

const percentOf = (cents: number, percent: number) => Math.round((cents * percent) / 100);

const sanitize = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

// Discount applies to the subtotal; tax applies to the discounted amount.
export const computeQuoteTotals = ({
  lines,
  discountPercent,
  taxPercent,
}: {
  lines: QuoteLineInput[];
  discountPercent: number;
  taxPercent: number;
}): QuoteTotals => {
  const lineTotalsCents = lines.map((line) =>
    Math.round(sanitize(line.quantity) * toCents(sanitize(line.unitPriceMicros))),
  );
  const subtotalCents = lineTotalsCents.reduce((sum, cents) => sum + cents, 0);
  const discountCents = percentOf(subtotalCents, Math.min(sanitize(discountPercent), 100));
  const taxCents = percentOf(subtotalCents - discountCents, sanitize(taxPercent));

  return {
    lineTotalsMicros: lineTotalsCents.map(toMicros),
    subtotalMicros: toMicros(subtotalCents),
    discountMicros: toMicros(discountCents),
    taxMicros: toMicros(taxCents),
    totalMicros: toMicros(subtotalCents - discountCents + taxCents),
  };
};

export const majorToMicros = (amount: number) => toMicros(Math.round(sanitize(amount) * 100));

export const microsToMajor = (micros: number) => toCents(micros) / 100;

export const formatMoney = (micros: number, currencyCode: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(
      microsToMajor(micros),
    );
  } catch {
    return `${microsToMajor(micros).toFixed(2)} ${currencyCode}`;
  }
};
