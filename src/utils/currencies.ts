// Currencies offered in the quote editor. The browser knows every current ISO 4217 currency and
// its name; the common ones are listed first so most members never scroll.

export const COMMON_CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'SGD', 'AED', 'CHF', 'JPY'];

export type CurrencyOption = { code: string; label: string };

// Part of ES2022, newer than the project's TypeScript lib setting, and missing in older browsers.
const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'currency') => string[] };

const listAllCurrencyCodes = (): string[] => {
  try {
    const codes = intl.supportedValuesOf?.('currency');

    if (codes && codes.length > 0) {
      return codes;
    }
  } catch {
    // Older browsers: the common list below still works.
  }

  return COMMON_CURRENCY_CODES;
};

const toOption = (code: string, names: Intl.DisplayNames | null): CurrencyOption => {
  let name: string | undefined;

  try {
    name = names?.of(code);
  } catch {
    name = undefined;
  }

  return { code, label: name && name !== code ? `${code} — ${name}` : code };
};

// The quote's current currency always appears, even when it is not a known code, so an
// existing quote never loses its currency.
export const buildCurrencyOptions = (currentCode: string) => {
  let names: Intl.DisplayNames | null = null;

  try {
    names = new Intl.DisplayNames(['en'], { type: 'currency' });
  } catch {
    names = null;
  }

  const common = COMMON_CURRENCY_CODES.includes(currentCode)
    ? COMMON_CURRENCY_CODES
    : [currentCode, ...COMMON_CURRENCY_CODES];
  const others = listAllCurrencyCodes()
    .filter((code) => !common.includes(code))
    .sort();

  return {
    common: common.map((code) => toOption(code, names)),
    others: others.map((code) => toOption(code, names)),
  };
};
