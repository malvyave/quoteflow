import { QuoteStatus } from 'src/objects/quote.object';

export type PublicPageState = 'quote' | 'not-found' | 'superseded' | 'declined';

// What a client sees when they open a quote link with this status.
export const getPublicPageState = (status: string | null | undefined): PublicPageState => {
  switch (status) {
    case QuoteStatus.SENT:
    case QuoteStatus.ACCEPTED:
      return 'quote';
    case QuoteStatus.SUPERSEDED:
      return 'superseded';
    case QuoteStatus.DECLINED:
      return 'declined';
    default:
      // Drafts keep no public link: a withdrawn quote reads as not found.
      return 'not-found';
  }
};

export type AcceptanceDecision = 'accept' | 'already-accepted' | 'expired' | 'unavailable';

// Whether a click on Accept should go ahead. Only one quote per opportunity can win.
export const decideAcceptance = ({
  status,
  hasOtherAcceptedQuote,
  isExpired,
}: {
  status: string;
  hasOtherAcceptedQuote: boolean;
  isExpired: boolean;
}): AcceptanceDecision => {
  if (status === QuoteStatus.ACCEPTED) {
    return 'already-accepted';
  }

  if (status !== QuoteStatus.SENT || hasOtherAcceptedQuote) {
    return 'unavailable';
  }

  if (isExpired) {
    return 'expired';
  }

  return 'accept';
};
