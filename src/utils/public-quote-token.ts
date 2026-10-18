// 32 random bytes (256 bits) as hex: unguessable, and safe to put in a URL path.
export const generatePublicToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

export const isValidPublicToken = (token: string | undefined): token is string =>
  typeof token === 'string' && /^[0-9a-f]{64}$/.test(token);

export const PUBLIC_QUOTE_ROUTE_PREFIX = '/quote';

export const QUOTE_ACTIONS_ROUTE_PREFIX = '/quote-actions';
