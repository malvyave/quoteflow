import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import { type QuoteSeller } from 'src/utils/public-quote-page';
import { splitAddressSetting, toSafeColor, toSafeImageUrl } from 'src/utils/quote-details';

// App variables are read with getApplicationVariable in the editor and from process.env in
// logic functions; both go through this so the two places never disagree.
export type ReadVariable = (key: string) => string | undefined;

const readText = (read: ReadVariable, key: string) => read(key)?.trim() || null;

// The app settings win; the workspace's own name and logo fill in what is left empty.
// Reading the workspace can fail (permissions, older servers), and a quote still renders without it.
export const loadQuoteSeller = async (read: ReadVariable): Promise<QuoteSeller> => {
  const configured: QuoteSeller = {
    name: readText(read, 'SELLER_NAME'),
    logoUrl: toSafeImageUrl(read('SELLER_LOGO_URL')),
    addressLines: splitAddressSetting(read('SELLER_ADDRESS')),
    email: readText(read, 'SELLER_EMAIL'),
    phone: readText(read, 'SELLER_PHONE'),
    website: readText(read, 'SELLER_WEBSITE'),
    taxId: readText(read, 'SELLER_TAX_ID'),
    paymentInstructions: readText(read, 'PAYMENT_INSTRUCTIONS'),
    accentColor: toSafeColor(read('BRAND_COLOR')),
  };

  if (configured.name && configured.logoUrl) {
    return configured;
  }

  try {
    const { currentWorkspace } = await new MetadataApiClient().query({
      currentWorkspace: { displayName: true, logo: true },
    });

    return {
      ...configured,
      name: configured.name ?? (currentWorkspace?.displayName?.trim() || null),
      logoUrl: configured.logoUrl ?? toSafeImageUrl(currentWorkspace?.logo),
    };
  } catch {
    return configured;
  }
};
