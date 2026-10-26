import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// getEntitlement with the app key-value store and the network replaced by fakes.

const store = new Map<string, unknown>();

vi.mock('twenty-sdk/logic-function', () => ({
  kv: {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: unknown) => {
      store.set(key, value);
    },
    delete: async (key: string) => store.delete(key),
  },
}));

const { getEntitlement, isLifetimeAvailable } = await import('src/utils/billing-server');

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  store.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  process.env.DODO_API_KEY = 'test-key';
  process.env.DODO_MONTHLY_PRODUCT_ID = 'pdt_monthly';
  process.env.DODO_ANNUAL_PRODUCT_ID = 'pdt_annual';
  process.env.DODO_LIFETIME_PRODUCT_ID = 'pdt_lifetime';
  process.env.DODO_MODE = 'test';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DODO_API_KEY;
  delete process.env.DODO_MONTHLY_PRODUCT_ID;
  delete process.env.DODO_ANNUAL_PRODUCT_ID;
  delete process.env.DODO_LIFETIME_PRODUCT_ID;
  delete process.env.DODO_MODE;
});

describe('getEntitlement', () => {
  it('treats a workspace without a Dodo customer as unpaid, without calling Dodo', async () => {
    await expect(getEntitlement()).resolves.toMatchObject({ isPaid: false, customerId: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads the paid status from the stored customer and caches it', async () => {
    store.set('billing:customer', { customerId: 'cus_1' });
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        items: [{ subscription_id: 'sub_1', status: 'active', product_id: 'pdt_monthly' }],
      }),
    );

    await expect(getEntitlement()).resolves.toMatchObject({ isPaid: true, plan: 'monthly', customerId: 'cus_1' });
    await expect(getEntitlement()).resolves.toMatchObject({ isPaid: true, plan: 'monthly' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('customer_id=cus_1');
  });

  it('recognises a Lifetime purchase from a one-time payment', async () => {
    store.set('billing:customer', { customerId: 'cus_1' });
    fetchMock.mockImplementation(async (url) =>
      String(url).includes('/payments')
        ? jsonResponse(200, { items: [{ payment_id: 'pay_1', status: 'succeeded' }] })
        : jsonResponse(200, { items: [] }),
    );

    await expect(getEntitlement()).resolves.toMatchObject({ isPaid: true, plan: 'lifetime' });
  });

  it('treats a customer with no subscription or payment as unpaid', async () => {
    store.set('billing:customer', { customerId: 'cus_1' });
    fetchMock.mockImplementation(async () => jsonResponse(200, { items: [] }));

    await expect(getEntitlement()).resolves.toMatchObject({ isPaid: false, plan: null });
  });

  it('rechecks an unpaid workspace once the short cache has expired', async () => {
    store.set('billing:customer', { customerId: 'cus_1' });
    store.set('billing:entitlement', {
      isPaid: false,
      customerId: 'cus_1',
      checkedAt: Date.now() - 2 * 60 * 1000,
    });
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        items: [{ subscription_id: 'sub_1', status: 'active', product_id: 'pdt_monthly' }],
      }),
    );

    await expect(getEntitlement()).resolves.toMatchObject({ isPaid: true });
  });

  it('fails open when Dodo cannot be reached, and does not cache that answer', async () => {
    store.set('billing:customer', { customerId: 'cus_1' });
    fetchMock.mockRejectedValue(new Error('network down'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(getEntitlement()).resolves.toMatchObject({ isPaid: true });
    expect(store.has('billing:entitlement')).toBe(false);
  });

  it('fails open when Dodo rejects the request', async () => {
    store.set('billing:customer', { customerId: 'cus_1' });
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Invalid API key' }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(getEntitlement()).resolves.toMatchObject({ isPaid: true });
  });
});

describe('isLifetimeAvailable', () => {
  const lifetimeSales = (count: number) =>
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        items: Array.from({ length: count }, (_, index) => ({ payment_id: `pay_${index}`, status: 'succeeded' })),
      }),
    );

  it('is available while fewer than 75 workspaces have bought it, and caches the count', async () => {
    lifetimeSales(74);

    await expect(isLifetimeAvailable()).resolves.toBe(true);
    await expect(isLifetimeAvailable()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('is sold out at 75', async () => {
    lifetimeSales(75);

    await expect(isLifetimeAvailable()).resolves.toBe(false);
  });

  it('is not offered without a Lifetime product', async () => {
    delete process.env.DODO_LIFETIME_PRODUCT_ID;

    await expect(isLifetimeAvailable()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
