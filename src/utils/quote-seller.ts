import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import { type QuoteSeller } from 'src/utils/public-quote-page';
import { toSafeImageUrl } from 'src/utils/quote-details';

// The app settings win; the workspace's own name and logo fill in what is left empty.
// Reading the workspace can fail (permissions, older servers), and a quote still renders without it.
export const loadQuoteSeller = async ({
  sellerName,
  sellerLogoUrl,
}: {
  sellerName: string | undefined;
  sellerLogoUrl: string | undefined;
}): Promise<QuoteSeller> => {
  const configuredName = sellerName?.trim() || null;
  const configuredLogoUrl = toSafeImageUrl(sellerLogoUrl);

  if (configuredName && configuredLogoUrl) {
    return { name: configuredName, logoUrl: configuredLogoUrl };
  }

  try {
    const { currentWorkspace } = await new MetadataApiClient().query({
      currentWorkspace: { displayName: true, logo: true },
    });

    return {
      name: configuredName ?? (currentWorkspace?.displayName?.trim() || null),
      logoUrl: configuredLogoUrl ?? toSafeImageUrl(currentWorkspace?.logo),
    };
  } catch {
    return { name: configuredName, logoUrl: configuredLogoUrl };
  }
};
