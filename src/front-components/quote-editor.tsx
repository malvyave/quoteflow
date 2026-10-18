import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { RestApiClient } from 'twenty-client-sdk/rest';
import {
  copyToClipboard,
  enqueueSnackbar,
  getApplicationVariable,
  openCommandConfirmationModal,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';
import { Tag } from 'twenty-ui/primitives/data-display';
import {
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconPlus,
  IconSend,
  IconTrash,
} from 'twenty-ui/icon';
import { Button } from 'twenty-ui/primitives/input';
import { useTheme } from 'twenty-ui/theme';

import { QUOTE_EDITOR_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { QuoteStatus } from 'src/objects/quote.object';
import {
  computeDraftTotals,
  loadQuoteDraft,
  newLineItemDraft,
  parseNumber,
  saveQuoteDraft,
  sendQuote,
  withdrawQuote,
  type LineItemDraft,
  type QuoteDraft,
} from 'src/utils/quote-api';
import { renderQuotePage, type QuoteSeller } from 'src/utils/public-quote-page';
import { PUBLIC_QUOTE_ROUTE_PREFIX } from 'src/utils/public-quote-token';
import { addDays, isQuoteExpired, toIsoDate, toQuoteReference } from 'src/utils/quote-details';
import { loadQuoteSeller } from 'src/utils/quote-seller';
import { formatMoney, majorToMicros } from 'src/utils/quote-totals';

const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'SGD', 'AED', 'CHF', 'JPY'];

const STATUS_TAGS: Record<
  string,
  { label: string; color: 'gray' | 'blue' | 'green' | 'red' | 'orange' }
> = {
  [QuoteStatus.DRAFT]: { label: 'Draft', color: 'gray' },
  [QuoteStatus.SENT]: { label: 'Sent', color: 'blue' },
  [QuoteStatus.ACCEPTED]: { label: 'Accepted', color: 'green' },
  [QuoteStatus.DECLINED]: { label: 'Declined', color: 'red' },
  [QuoteStatus.SUPERSEDED]: { label: 'Superseded', color: 'orange' },
};

const VALIDITY_PRESET_DAYS = [7, 14, 30, 60, 90];

const formatShortDate = (isoDate: string) =>
  new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

// Keeps digits and the first decimal point, so amounts can't go negative or contain letters.
const toDecimalInput = (value: string) => {
  const [whole, ...decimals] = value.replace(/[^0-9.]/g, '').split('.');

  return decimals.length > 0 ? `${whole}.${decimals.join('')}` : whole;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.';

const QuoteEditor = () => {
  const theme = useTheme();
  const [opportunityId] = useSelectedRecordIds();

  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [removedLineItemIds, setRemovedLineItemIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [seller, setSeller] = useState<QuoteSeller>({ name: null, logoUrl: null });

  useEffect(() => {
    loadQuoteSeller({
      sellerName: getApplicationVariable('SELLER_NAME'),
      sellerLogoUrl: getApplicationVariable('SELLER_LOGO_URL'),
    }).then(setSeller);
  }, []);

  const load = useCallback(async () => {
    if (!opportunityId) {
      return;
    }

    setLoadError(null);

    try {
      const loaded = await loadQuoteDraft(opportunityId);

      setDraft(loaded);
      setSavedSnapshot(JSON.stringify(loaded));
      setRemovedLineItemIds([]);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    }
  }, [opportunityId]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => (draft ? computeDraftTotals(draft) : null), [draft]);

  const styles = useMemo(() => {
    // minWidth 0 lets inputs shrink below the browser's default input width in narrow panels.
    const input: CSSProperties = {
      width: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
      padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
      border: `1px solid ${theme.border.color.medium}`,
      borderRadius: theme.border.radius.sm,
      background: theme.background.primary,
      color: theme.font.color.primary,
      fontFamily: theme.font.family,
      fontSize: theme.font.size.md,
    };

    return {
      root: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing[4],
        padding: theme.spacing[4],
        fontFamily: theme.font.family,
        fontSize: theme.font.size.md,
        color: theme.font.color.primary,
      } satisfies CSSProperties,
      row: {
        display: 'grid',
        gridTemplateColumns:
          'minmax(96px, 3fr) minmax(44px, 1fr) minmax(72px, 1.5fr) minmax(72px, 1.5fr) 28px',
        gap: theme.spacing[2],
        alignItems: 'center',
      } satisfies CSSProperties,
      headerCell: {
        fontSize: theme.font.size.sm,
        color: theme.font.color.tertiary,
      } satisfies CSSProperties,
      input,
      numberInput: { ...input, textAlign: 'right' } satisfies CSSProperties,
      textarea: { ...input, resize: 'vertical', lineHeight: 1.5 } satisfies CSSProperties,
      amount: {
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      } satisfies CSSProperties,
      label: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing[1],
        fontSize: theme.font.size.sm,
        color: theme.font.color.tertiary,
      } satisfies CSSProperties,
      summary: {
        display: 'grid',
        gridTemplateColumns: 'auto 140px',
        gap: `${theme.spacing[1]} ${theme.spacing[4]}`,
        justifyContent: 'end',
        fontVariantNumeric: 'tabular-nums',
      } satisfies CSSProperties,
      muted: { color: theme.font.color.tertiary } satisfies CSSProperties,
    };
  }, [theme]);

  if (!opportunityId) {
    return <div style={styles.root}>Open an opportunity to build its quote.</div>;
  }

  if (loadError) {
    return (
      <div style={styles.root}>
        <span style={{ color: theme.font.color.danger }}>Could not load the quote: {loadError}</span>
        <div>
          <Button variant="outline" color="neutral" size="sm" onClick={load}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!draft || !totals) {
    return <div style={{ ...styles.root, ...styles.muted }}>Loading quote…</div>;
  }

  const isEditable = draft.status === QuoteStatus.DRAFT;
  const isDirty = JSON.stringify(draft) !== savedSnapshot;
  const statusTag = STATUS_TAGS[draft.status] ?? STATUS_TAGS[QuoteStatus.DRAFT];
  const money = (micros: number) => formatMoney(micros, draft.currencyCode);
  const currencyOptions = CURRENCY_CODES.includes(draft.currencyCode)
    ? CURRENCY_CODES
    : [draft.currencyCode, ...CURRENCY_CODES];

  const updateDraft = (changes: Partial<QuoteDraft>) =>
    setDraft((current) => (current ? { ...current, ...changes } : current));

  const updateLineItem = (key: string, changes: Partial<LineItemDraft>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            lineItems: current.lineItems.map((lineItem) =>
              lineItem.key === key ? { ...lineItem, ...changes } : lineItem,
            ),
          }
        : current,
    );

  const addLineItem = () =>
    setDraft((current) =>
      current ? { ...current, lineItems: [...current.lineItems, newLineItemDraft()] } : current,
    );

  const removeLineItem = (lineItem: LineItemDraft) => {
    if (lineItem.id !== null) {
      setRemovedLineItemIds((ids) => [...ids, lineItem.id as string]);
    }

    setDraft((current) =>
      current
        ? { ...current, lineItems: current.lineItems.filter(({ key }) => key !== lineItem.key) }
        : current,
    );
  };

  const save = async () => {
    const unnamed = draft.lineItems.some(
      (lineItem) => lineItem.name.trim() === '' && lineItem.unitPrice.trim() !== '',
    );

    if (unnamed) {
      enqueueSnackbar({ message: 'Give every priced line item a description.', variant: 'error' });

      return;
    }

    setIsSaving(true);

    try {
      // Drop rows the user added but never filled in.
      const lineItems = draft.lineItems.filter(
        (lineItem) => lineItem.id !== null || lineItem.name.trim() !== '',
      );

      await saveQuoteDraft({
        opportunityId,
        draft: { ...draft, lineItems },
        removedLineItemIds,
      });
      await load();
      enqueueSnackbar({ message: 'Quote saved', variant: 'success' });
    } catch (error) {
      enqueueSnackbar({
        message: `Could not save the quote: ${getErrorMessage(error)}`,
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const publicUrl =
    draft.publicToken && draft.status !== QuoteStatus.DRAFT
      ? new RestApiClient().resolveUrl(`/s${PUBLIC_QUOTE_ROUTE_PREFIX}/${draft.publicToken}`)
      : null;
  const hasNamedLineItem = draft.lineItems.some((lineItem) => lineItem.name.trim() !== '');
  const canSend = draft.id !== null && !isDirty && hasNamedLineItem && !isSaving;

  const changeStatus = async ({
    title,
    subtitle,
    confirmButtonText,
    confirmButtonAccent,
    action,
    successMessage,
  }: {
    title: string;
    subtitle: string;
    confirmButtonText: string;
    confirmButtonAccent: 'blue' | 'danger';
    action: (quoteId: string) => Promise<void>;
    successMessage: string;
  }) => {
    if (draft.id === null) {
      return;
    }

    const choice = await openCommandConfirmationModal({
      title,
      subtitle,
      confirmButtonText,
      confirmButtonAccent,
    });

    if (choice !== 'confirm') {
      return;
    }

    setIsChangingStatus(true);

    try {
      await action(draft.id);
      await load();
      enqueueSnackbar({ message: successMessage, variant: 'success' });
    } catch (error) {
      enqueueSnackbar({ message: getErrorMessage(error), variant: 'error' });
    } finally {
      setIsChangingStatus(false);
    }
  };

  const send = () =>
    changeStatus({
      title: 'Send this quote?',
      subtitle:
        'You will get a link to share with your client. The quote is locked while it is out for acceptance.',
      confirmButtonText: 'Send quote',
      confirmButtonAccent: 'blue',
      action: sendQuote,
      successMessage: 'Quote sent. Copy the link below to share it.',
    });

  const withdraw = () =>
    changeStatus({
      title: 'Withdraw and edit?',
      subtitle:
        'The current link will stop working. Send the quote again after editing to get a new link.',
      confirmButtonText: 'Withdraw',
      confirmButtonAccent: 'danger',
      action: withdrawQuote,
      successMessage: 'Quote moved back to draft',
    });

  // Twenty shows its own "copied" or "couldn't copy" toast, so none is added here.
  const copyLink = () => {
    if (publicUrl) {
      copyToClipboard(publicUrl);
    }
  };

  if (isPreviewing) {
    // The same renderer as the public page, fed with the unsaved draft.
    const previewHtml = renderQuotePage({
      quote: {
        reference: draft.number !== null ? toQuoteReference('', draft.number) : 'Draft',
        name: draft.name.trim() || 'Quote',
        status: draft.status,
        currencyCode: draft.currencyCode,
        discountPercent: parseNumber(draft.discountPercent),
        taxPercent: parseNumber(draft.taxPercent),
        sentAt: draft.sentAt,
        acceptedAt: draft.acceptedAt,
        expiresAt: draft.expiresAt || null,
        message: draft.message,
        terms: draft.terms,
        companyName: draft.companyName,
        seller,
        lineItems: draft.lineItems
          .filter((lineItem) => lineItem.name.trim() !== '')
          .map((lineItem) => ({
            name: lineItem.name,
            quantity: parseNumber(lineItem.quantity),
            unitPriceMicros: majorToMicros(parseNumber(lineItem.unitPrice)),
          })),
      },
      acceptActionUrl: '',
      isPreview: true,
      isExpired: isQuoteExpired(draft.expiresAt, new Date()),
    });

    return (
      <div style={styles.root}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={styles.muted}>Preview as buyer{isDirty ? ' (includes unsaved changes)' : ''}</span>
          <Button variant="outline" color="neutral" size="sm" onClick={() => setIsPreviewing(false)}>
            Back to editing
          </Button>
        </div>
        <iframe
          title="Quote preview"
          srcDoc={previewHtml}
          sandbox=""
          style={{
            width: '100%',
            height: '720px',
            border: `1px solid ${theme.border.color.medium}`,
            borderRadius: theme.border.radius.md,
            background: theme.background.primary,
          }}
        />
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
        <input
          aria-label="Quote name"
          value={draft.name}
          disabled={!isEditable}
          onChange={(event) => updateDraft({ name: event.target.value })}
          style={{ ...styles.input, fontWeight: theme.font.weight.medium, flex: 1 }}
        />
        {draft.number !== null && (
          <span style={styles.muted}>{toQuoteReference('', draft.number)}</span>
        )}
        <Tag color={statusTag.color}>{statusTag.label}</Tag>
      </div>

      {!isEditable && (
        <span style={styles.muted}>
          This quote has been {statusTag.label.toLowerCase()} and can no longer be edited.
        </span>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }}>
        <div style={styles.row}>
          <span style={styles.headerCell}>Description</span>
          <span style={{ ...styles.headerCell, textAlign: 'right' }}>Qty</span>
          <span style={{ ...styles.headerCell, textAlign: 'right' }}>Unit price</span>
          <span style={{ ...styles.headerCell, textAlign: 'right' }}>Amount</span>
          <span />
        </div>

        {draft.lineItems.map((lineItem, index) => (
          <div key={lineItem.key} style={styles.row}>
            <input
              aria-label={`Line ${index + 1} description`}
              autoComplete="off"
              placeholder="e.g. Homepage redesign"
              value={lineItem.name}
              disabled={!isEditable}
              onChange={(event) => updateLineItem(lineItem.key, { name: event.target.value })}
              style={styles.input}
            />
            <input
              aria-label={`Line ${index + 1} quantity`}
              autoComplete="off"
              inputMode="decimal"
              value={lineItem.quantity}
              disabled={!isEditable}
              onChange={(event) =>
                updateLineItem(lineItem.key, { quantity: toDecimalInput(event.target.value) })
              }
              style={styles.numberInput}
            />
            <input
              aria-label={`Line ${index + 1} unit price`}
              autoComplete="off"
              inputMode="decimal"
              placeholder="0.00"
              value={lineItem.unitPrice}
              disabled={!isEditable}
              onChange={(event) =>
                updateLineItem(lineItem.key, { unitPrice: toDecimalInput(event.target.value) })
              }
              style={styles.numberInput}
            />
            <span style={styles.amount}>{money(totals.lineTotalsMicros[index] ?? 0)}</span>
            {isEditable ? (
              <Button
                aria-label={`Remove line ${index + 1}`}
                variant="ghost"
                color="neutral"
                size="sm"
                startIcon={<IconTrash size={theme.icon.size.sm} />}
                onClick={() => removeLineItem(lineItem)}
              />
            ) : (
              <span />
            )}
          </div>
        ))}

        {draft.lineItems.length === 0 && <span style={styles.muted}>No line items yet.</span>}

        {isEditable && (
          <div>
            <Button
              variant="ghost"
              color="neutral"
              size="sm"
              startIcon={<IconPlus size={theme.icon.size.sm} />}
              onClick={addLineItem}
            >
              Add line item
            </Button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: theme.spacing[4], flexWrap: 'wrap' }}>
        <label style={styles.label}>
          Currency
          <select
            value={draft.currencyCode}
            disabled={!isEditable}
            onChange={(event) => updateDraft({ currencyCode: event.target.value })}
            style={{ ...styles.input, width: '96px' }}
          >
            {currencyOptions.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label style={styles.label}>
          Discount (%)
          <input
            inputMode="decimal"
            value={draft.discountPercent}
            disabled={!isEditable}
            onChange={(event) => updateDraft({ discountPercent: toDecimalInput(event.target.value) })}
            style={{ ...styles.numberInput, width: '96px' }}
          />
        </label>
        <label style={styles.label}>
          Tax (%)
          <input
            inputMode="decimal"
            value={draft.taxPercent}
            disabled={!isEditable}
            onChange={(event) => updateDraft({ taxPercent: toDecimalInput(event.target.value) })}
            style={{ ...styles.numberInput, width: '96px' }}
          />
        </label>
        {/* A select, not a date input: native date pickers do not open inside the component sandbox. */}
        <label style={styles.label}>
          Valid until
          <select
            value={draft.expiresAt === '' ? 'none' : 'current'}
            disabled={!isEditable}
            onChange={(event) =>
              updateDraft({
                expiresAt:
                  event.target.value === 'none'
                    ? ''
                    : event.target.value === 'current'
                      ? draft.expiresAt
                      : toIsoDate(addDays(new Date(), Number(event.target.value))),
              })
            }
            style={{ ...styles.input, width: 'auto' }}
          >
            {draft.expiresAt !== '' && (
              <option value="current">{formatShortDate(draft.expiresAt)}</option>
            )}
            {VALIDITY_PRESET_DAYS.map((days) => (
              <option key={days} value={String(days)}>
                {days} days — until {formatShortDate(toIsoDate(addDays(new Date(), days)))}
              </option>
            ))}
            <option value="none">No expiry</option>
          </select>
        </label>
      </div>

      <label style={styles.label}>
        Message to client
        <textarea
          rows={3}
          placeholder="e.g. Thanks for your time today. Here is the proposal we discussed."
          value={draft.message}
          disabled={!isEditable}
          onChange={(event) => updateDraft({ message: event.target.value })}
          style={styles.textarea}
        />
      </label>

      <label style={styles.label}>
        Terms
        <textarea
          rows={3}
          placeholder="e.g. Payment due within 30 days. Prices exclude travel."
          value={draft.terms}
          disabled={!isEditable}
          onChange={(event) => updateDraft({ terms: event.target.value })}
          style={styles.textarea}
        />
      </label>

      <div style={styles.summary}>
        <span style={styles.muted}>Subtotal</span>
        <span style={styles.amount}>{money(totals.subtotalMicros)}</span>
        <span style={styles.muted}>Discount</span>
        <span style={styles.amount}>
          {totals.discountMicros > 0 ? '−' : ''}
          {money(totals.discountMicros)}
        </span>
        <span style={styles.muted}>Tax</span>
        <span style={styles.amount}>{money(totals.taxMicros)}</span>
        <span style={{ fontWeight: theme.font.weight.semiBold }}>Total</span>
        <span style={{ ...styles.amount, fontWeight: theme.font.weight.semiBold }}>
          {money(totals.totalMicros)}
        </span>
      </div>

      {publicUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }}>
          <span style={styles.label}>Client link</span>
          <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center' }}>
            <input
              aria-label="Client link"
              readOnly
              value={publicUrl}
              style={{ ...styles.input, flex: 1, color: theme.font.color.secondary }}
            />
            <Button
              variant="outline"
              color="neutral"
              size="sm"
              startIcon={<IconCopy size={theme.icon.size.sm} />}
              onClick={copyLink}
            >
              Copy
            </Button>
            <Button
              variant="outline"
              color="neutral"
              size="sm"
              startIcon={<IconDownload size={theme.icon.size.sm} />}
              href={`${publicUrl}?print=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              PDF
            </Button>
            <Button
              aria-label="Open client link"
              variant="ghost"
              color="neutral"
              size="sm"
              startIcon={<IconExternalLink size={theme.icon.size.sm} />}
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'end', gap: theme.spacing[2] }}>
        {isEditable && isDirty && (
          <span style={{ ...styles.muted, alignSelf: 'center' }}>Unsaved changes</span>
        )}
        <Button
          variant="ghost"
          color="neutral"
          size="sm"
          startIcon={<IconEye size={theme.icon.size.sm} />}
          onClick={() => setIsPreviewing(true)}
        >
          Preview as buyer
        </Button>
        {isEditable && (
          <Button
            variant={isDirty || draft.id === null ? 'solid' : 'outline'}
            color={isDirty || draft.id === null ? 'accent' : 'neutral'}
            size="sm"
            loading={isSaving}
            disabled={!isDirty || isSaving}
            onClick={save}
          >
            {draft.id === null ? 'Create quote' : 'Save quote'}
          </Button>
        )}
        {isEditable && draft.id !== null && (
          <Button
            variant="solid"
            color="accent"
            size="sm"
            startIcon={<IconSend size={theme.icon.size.sm} />}
            loading={isChangingStatus}
            disabled={!canSend || isChangingStatus}
            onClick={send}
          >
            Send quote
          </Button>
        )}
        {draft.status === QuoteStatus.SENT && (
          <Button
            variant="outline"
            color="neutral"
            size="sm"
            loading={isChangingStatus}
            disabled={isChangingStatus}
            onClick={withdraw}
          >
            Withdraw and edit
          </Button>
        )}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: QUOTE_EDITOR_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Quote editor',
  description: 'Line-item editor with live totals for an opportunity quote',
  component: QuoteEditor,
});
