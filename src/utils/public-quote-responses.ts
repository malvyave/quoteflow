import { Response } from 'twenty-sdk/logic-function';

import { renderMessagePage } from 'src/utils/public-quote-page';
import { type PublicPageState } from 'src/utils/public-quote-state';

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

export const quoteUnavailableResponse = (state: Exclude<PublicPageState, 'quote'>) => {
  switch (state) {
    case 'superseded':
      return htmlResponse(
        renderMessagePage(
          'Quote replaced',
          'This quote has been replaced by another quote for the same deal. Please contact the sender if you have questions.',
        ),
        410,
      );
    case 'declined':
      return htmlResponse(
        renderMessagePage('Quote declined', 'This quote has been declined and can no longer be accepted.'),
        410,
      );
    default:
      return quoteNotFoundResponse();
  }
};
