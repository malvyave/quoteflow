import { Response } from 'twenty-sdk/logic-function';

import { renderMessagePage } from 'src/utils/public-quote-page';

export const htmlResponse = (html: string, status = 200) =>
  new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });

export const quoteNotFoundResponse = () =>
  htmlResponse(
    renderMessagePage(
      'Quote not available',
      'This quote link is invalid or has been withdrawn. Please contact the sender for an updated link.',
    ),
    404,
  );
