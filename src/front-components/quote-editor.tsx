import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
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
  IconMail,
  IconArrowLeft,
  IconArrowRight,
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
  loadPlanStatus,
  saveQuoteDraft,
  sendQuote,
  startUpgrade,
  withdrawQuote,
  type LineItemDraft,
  type PlanStatus,
  type QuoteDraft,
} from 'src/utils/quote-api';
import { EMPTY_SELLER, type QuoteSeller } from 'src/utils/public-quote-page';
import { PUBLIC_QUOTE_ROUTE_PREFIX } from 'src/utils/public-quote-token';
import { PLANS, trialOverMessage, type Plan } from 'src/utils/billing';
import { buildCurrencyOptions } from 'src/utils/currencies';
import { addDays, toIsoDate, toQuoteReference } from 'src/utils/quote-details';
import { buildQuoteEmail, toMailtoUrl, toPlainEmail, type QuoteEmail } from 'src/utils/quote-email';
import { renderDraftPreview } from 'src/utils/quote-preview';
import { loadQuoteSeller } from 'src/utils/quote-seller';
import { formatMoney } from 'src/utils/quote-totals';

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

const SENT_QUOTE_REFRESH_MS = 15_000;

const formatShortDate = (isoDate: string) =>
  new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

// Moments the client acted, in the member's own time zone.
const formatDateTime = (isoDateTime: string) =>
  new Date(isoDateTime).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

// Keeps digits and the first decimal point, so amounts can't go negative or contain letters.
const toDecimalInput = (value: string) => {
  const [whole, ...decimals] = value.replace(/[^0-9.]/g, '').split('.');

  return decimals.length > 0 ? `${whole}.${decimals.join('')}` : whole;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.';

type WizardStep = 'edit' | 'review';

// matchMedia answers for this component's own box, not the browser window, so this follows the
// width Twenty gives the Quote tab.
const WIDE_LAYOUT_QUERY = '(min-width: 900px)';

const useIsWideWidget = () => {
  const [isWide, setIsWide] = useState(
    () => typeof matchMedia === 'function' && matchMedia(WIDE_LAYOUT_QUERY).matches,
  );

  useEffect(() => {
    if (typeof matchMedia !== 'function') {
      return;
    }

    const query = matchMedia(WIDE_LAYOUT_QUERY);
    const update = () => setIsWide(query.matches);

    update();
    query.addEventListener('change', update);

    return () => query.removeEventListener('change', update);
  }, []);

  return isWide;
};

const QuoteEditor = () => {
  const theme = useTheme();
  const [opportunityId] = useSelectedRecordIds();

  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [removedLineItemIds, setRemovedLineItemIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [step, setStep] = useState<WizardStep>('edit');
  const [isNarrowPreviewOpen, setIsNarrowPreviewOpen] = useState(false);
  const isWide = useIsWideWidget();
  const [seller, setSeller] = useState<QuoteSeller>(EMPTY_SELLER);
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [billingUrl, setBillingUrl] = useState<{ kind: 'checkout' | 'portal'; url: string } | null>(
    null,
  );
  const [isOpeningBilling, setIsOpeningBilling] = useState(false);
  const [isChoosingPlan, setIsChoosingPlan] = useState(false);
  // Changes the member makes to the suggested email; never saved.
  const [emailEdits, setEmailEdits] = useState<Partial<QuoteEmail>>({});

  // The plan bar is informational: if it cannot load, the editor still works.
  const refreshPlan = useCallback(() => {
    loadPlanStatus()
      .then(setPlan)
      .catch(() => setPlan(null));
  }, []);

  useEffect(() => {
    loadQuoteSeller(getApplicationVariable).then(setSeller);
  }, []);

  const load = useCallback(async () => {
    if (!opportunityId) {
      return;
    }

    setLoadError(null);

    try {
      const loaded = await loadQuoteDraft(opportunityId, {
        message: getApplicationVariable('DEFAULT_MESSAGE')?.trim() ?? '',
        terms: getApplicationVariable('DEFAULT_TERMS')?.trim() ?? '',
      });

      setDraft(loaded);
      setSavedSnapshot(JSON.stringify(loaded));
      setRemovedLineItemIds([]);
      setStep((current) => (loaded.status === QuoteStatus.DRAFT ? current : 'review'));
      refreshPlan();
    } catch (error) {
      setLoadError(getErrorMessage(error));
    }
  }, [opportunityId, refreshPlan]);

  useEffect(() => {
    load();
  }, [load]);

  // A sent quote changes outside this tab when the client accepts it, so check again when the
  // member comes back to the tab and every little while. Drafts are never refreshed, so nothing
  // the member is typing gets overwritten.
  const isAwaitingClient = draft?.status === QuoteStatus.SENT && !isChangingStatus;

  useEffect(() => {
    if (!isAwaitingClient || !opportunityId) {
      return;
    }

    let isCancelled = false;

    const refresh = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      try {
        const loaded = await loadQuoteDraft(opportunityId);
        const snapshot = JSON.stringify(loaded);

        if (!isCancelled && snapshot !== savedSnapshot) {
          setDraft(loaded);
          setSavedSnapshot(snapshot);
          refreshPlan();
        }
      } catch {
        // Quiet: the next check tries again.
      }
    };

    const interval = setInterval(refresh, SENT_QUOTE_REFRESH_MS);

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      isCancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [isAwaitingClient, opportunityId, savedSnapshot, refreshPlan]);

  // A new quote or a new link means a new suggested email.
  useEffect(() => {
    setEmailEdits({});
  }, [draft?.id, draft?.publicToken]);

  const totals = useMemo(() => (draft ? computeDraftTotals(draft) : null), [draft]);
  const deferredDraft = useDeferredValue(draft);
  const previewHtml = useMemo(
    () => (deferredDraft ? renderDraftPreview(deferredDraft, seller) : ''),
    [deferredDraft, seller],
  );

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
  const currencyOptions = buildCurrencyOptions(draft.currencyCode);

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

  const save = async (): Promise<boolean> => {
    const unnamed = draft.lineItems.some(
      (lineItem) => lineItem.name.trim() === '' && lineItem.unitPrice.trim() !== '',
    );

    if (unnamed) {
      enqueueSnackbar({ message: 'Give every priced line item a description.', variant: 'error' });

      return false;
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

      return true;
    } catch (error) {
      enqueueSnackbar({
        message: `Could not save the quote: ${getErrorMessage(error)}`,
        variant: 'error',
      });

      return false;
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
    nextStep,
  }: {
    title: string;
    subtitle: string;
    confirmButtonText: string;
    confirmButtonAccent: 'blue' | 'danger';
    action: (quoteId: string) => Promise<void>;
    successMessage: string;
    nextStep?: WizardStep;
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

      if (nextStep) {
        setStep(nextStep);
      }

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
      successMessage: 'Quote sent. Copy the link to share it with your client.',
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
      nextStep: 'edit',
    });

  // Opening a new tab needs a direct click on a link, so this fetches the billing URL first and
  // then shows a button that links to it.
  const openBilling = async (chosenPlan?: Plan) => {
    setIsOpeningBilling(true);

    try {
      setBillingUrl(await startUpgrade(chosenPlan));
      setIsChoosingPlan(false);
    } catch (error) {
      enqueueSnackbar({ message: getErrorMessage(error), variant: 'error' });
    } finally {
      setIsOpeningBilling(false);
    }
  };

  const suggestedEmail = buildQuoteEmail({
    reference: draft.number !== null && draft.id ? toQuoteReference(draft.id, draft.number) : 'Q-····',
    quoteName: draft.name,
    total: money(totals.totalMicros),
    validUntil: draft.expiresAt ? formatShortDate(draft.expiresAt) : null,
    message: draft.message,
    contactName: draft.client.contactName,
    contactEmail: draft.client.contactEmail,
    sellerName: seller.name,
    clientUrl: publicUrl,
  });
  const email: QuoteEmail = { ...suggestedEmail, ...emailEdits };
  const isEmailEdited = Object.keys(emailEdits).length > 0;

  // Twenty shows its own "copied" or "couldn't copy" toast, so none is added here.
  const copyEmail = () => copyToClipboard(toPlainEmail(email));

  const copyLink = () => {
    if (publicUrl) {
      copyToClipboard(publicUrl);
    }
  };

  // "Next" saves first, so step 2 always reviews exactly what the client will get.
  const goToReview = async () => {
    if (isEditable && !hasNamedLineItem) {
      enqueueSnackbar({ message: 'Add at least one line item first.', variant: 'error' });

      return;
    }

    if (isEditable && (isDirty || draft.id === null) && !(await save())) {
      return;
    }

    setStep('review');
  };

  const previewFrame = (height: string) => (
    <iframe
      title="Quote preview"
      srcDoc={previewHtml}
      sandbox=""
      style={{
        width: '100%',
        height,
        border: `1px solid ${theme.border.color.medium}`,
        borderRadius: theme.border.radius.md,
        background: theme.background.primary,
      }}
    />
  );

  const twoColumns = (left: ReactNode, right: ReactNode, leftWidth = 'minmax(0, 1fr)') =>
    isWide ? (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${leftWidth} minmax(0, 1fr)`,
          gap: theme.spacing[4],
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[4] }}>{left}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }}>{right}</div>
      </div>
    ) : (
      <>
        {left}
        {right}
      </>
    );

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
      <input
        aria-label="Quote name"
        value={draft.name}
        disabled={!isEditable || step === 'review'}
        onChange={(event) => updateDraft({ name: event.target.value })}
        style={{ ...styles.input, fontWeight: theme.font.weight.medium, flex: 1 }}
      />
      {draft.number !== null && <span style={styles.muted}>{toQuoteReference('', draft.number)}</span>}
      <Tag color={statusTag.color}>{statusTag.label}</Tag>
    </div>
  );

  const stepButton = (target: WizardStep, number: number, label: string, onClick: () => void) => {
    const isActive = step === target;

    return (
      <button
        type="button"
        aria-current={isActive ? 'step' : undefined}
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[2],
          padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
          border: `1px solid ${isActive ? theme.border.color.strong : theme.border.color.light}`,
          borderRadius: theme.border.radius.pill,
          background: isActive ? theme.background.tertiary : 'transparent',
          color: isActive ? theme.font.color.primary : theme.font.color.tertiary,
          fontFamily: theme.font.family,
          fontSize: theme.font.size.sm,
          fontWeight: isActive ? theme.font.weight.medium : theme.font.weight.regular,
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: isActive ? theme.font.color.primary : theme.background.tertiary,
            color: isActive ? theme.background.primary : theme.font.color.tertiary,
            fontSize: theme.font.size.xs,
          }}
        >
          {number}
        </span>
        {label}
      </button>
    );
  };

  const stepBar = (
    <nav aria-label="Quote steps" style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
      {stepButton('edit', 1, isEditable ? 'Edit' : 'Details', () => setStep('edit'))}
      <span style={styles.muted}>→</span>
      {stepButton('review', 2, 'Review & share', goToReview)}
    </nav>
  );

  const planSummary = (status: PlanStatus) => {
    if (status.isPaid) {
      return status.plan ? `${PLANS[status.plan].label} plan · unlimited quotes` : 'Paid plan · unlimited quotes';
    }

    if (!status.trial || status.trial.isOver) {
      return trialOverMessage(status.trial);
    }

    const { daysLeft, quotesUsed, quoteLimit } = status.trial;

    return `Free trial · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left · ${Math.min(quotesUsed, quoteLimit)} of ${quoteLimit} quotes sent`;
  };

  const offeredPlans = plan
    ? (Object.keys(PLANS) as Plan[]).filter((option) => option !== 'lifetime' || plan.isLifetimeAvailable)
    : [];

  const planBar = plan?.billingEnabled ? (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing[2],
        padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
        border: `1px solid ${theme.border.color.light}`,
        borderRadius: theme.border.radius.md,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing[2],
          flexWrap: 'wrap',
        }}
      >
        <span style={plan.trial?.isOver && !plan.isPaid ? undefined : styles.muted}>{planSummary(plan)}</span>
        {billingUrl ? (
          <Button
            variant="solid"
            color="accent"
            size="sm"
            startIcon={<IconExternalLink size={theme.icon.size.sm} />}
            href={billingUrl.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setBillingUrl(null)}
          >
            {billingUrl.kind === 'portal' ? 'Open billing portal' : 'Continue to checkout'}
          </Button>
        ) : plan.isPaid ? (
          plan.plan !== 'lifetime' && (
            <Button
              variant="ghost"
              color="neutral"
              size="sm"
              loading={isOpeningBilling}
              disabled={isOpeningBilling}
              onClick={() => openBilling()}
            >
              Manage billing
            </Button>
          )
        ) : (
          <Button
            variant={plan.trial?.isOver ? 'solid' : 'outline'}
            color={plan.trial?.isOver ? 'accent' : 'neutral'}
            size="sm"
            onClick={() => setIsChoosingPlan((current) => !current)}
          >
            {isChoosingPlan ? 'Hide plans' : 'Choose a plan'}
          </Button>
        )}
      </div>
      {isChoosingPlan && !plan.isPaid && !billingUrl && (
        <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
          {offeredPlans.map((option) => (
            <button
              key={option}
              type="button"
              disabled={isOpeningBilling}
              onClick={() => openBilling(option)}
              style={{
                flex: '1 1 140px',
                textAlign: 'left',
                padding: theme.spacing[2],
                border: `1px solid ${theme.border.color.medium}`,
                borderRadius: theme.border.radius.sm,
                background: theme.background.primary,
                color: theme.font.color.primary,
                fontFamily: theme.font.family,
                cursor: isOpeningBilling ? 'wait' : 'pointer',
              }}
            >
              <strong style={{ display: 'block' }}>{PLANS[option].label}</strong>
              <span style={{ display: 'block' }}>{PLANS[option].price}</span>
              <span style={{ ...styles.muted, display: 'block', fontSize: theme.font.size.sm }}>
                {PLANS[option].detail}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  ) : null;

  const editorFields = (
    <>
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
            style={{ ...styles.input, width: '220px', maxWidth: '100%' }}
          >
            <optgroup label="Common">
              {currencyOptions.common.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </optgroup>
            <optgroup label="All currencies">
              {currencyOptions.others.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </optgroup>
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
            {draft.expiresAt !== '' && <option value="current">{formatShortDate(draft.expiresAt)}</option>}
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
    </>
  );

  const editActions = (
    <div style={{ display: 'flex', justifyContent: 'end', alignItems: 'center', gap: theme.spacing[2] }}>
      {isEditable && isDirty && <span style={styles.muted}>Unsaved changes</span>}
      {isEditable && (
        <Button
          variant="outline"
          color="neutral"
          size="sm"
          loading={isSaving}
          disabled={!isDirty || isSaving}
          onClick={save}
        >
          {draft.id === null ? 'Create quote' : 'Save quote'}
        </Button>
      )}
      <Button
        variant="solid"
        color="accent"
        size="sm"
        endIcon={<IconArrowRight size={theme.icon.size.sm} />}
        loading={isSaving}
        disabled={isSaving || (isEditable && !hasNamedLineItem)}
        onClick={goToReview}
      >
        Next: Review & share
      </Button>
    </div>
  );

  const livePreview = isWide ? (
    <>
      <span style={styles.label}>Live preview · what your client will see</span>
      {previewFrame('760px')}
    </>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }}>
      <div>
        <Button
          variant="ghost"
          color="neutral"
          size="sm"
          onClick={() => setIsNarrowPreviewOpen((isOpen) => !isOpen)}
        >
          {isNarrowPreviewOpen ? 'Hide live preview' : 'Show live preview'}
        </Button>
      </div>
      {isNarrowPreviewOpen && previewFrame('640px')}
    </div>
  );

  const summaryRow = (label: string, value: ReactNode) => (
    <>
      <span style={styles.muted}>{label}</span>
      <span style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{value}</span>
    </>
  );

  const linkPanel = publicUrl ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }}>
      <span style={styles.label}>Client link</span>
      <input
        aria-label="Client link"
        readOnly
        value={publicUrl}
        style={{ ...styles.input, color: theme.font.color.secondary }}
      />
      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
        <Button
          variant="solid"
          color="accent"
          size="sm"
          startIcon={<IconCopy size={theme.icon.size.sm} />}
          onClick={copyLink}
        >
          Copy link
        </Button>
        <Button
          variant="outline"
          color="neutral"
          size="sm"
          startIcon={<IconDownload size={theme.icon.size.sm} />}
          href={`${publicUrl}?print=1&from=app`}
          target="_blank"
          rel="noopener noreferrer"
        >
          PDF
        </Button>
        <Button
          variant="ghost"
          color="neutral"
          size="sm"
          startIcon={<IconExternalLink size={theme.icon.size.sm} />}
          href={`${publicUrl}?from=app`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open
        </Button>
      </div>
    </div>
  ) : null;

  // QuoteFlow does not send email: the member sends this from their own email app, so replies
  // come straight back to them.
  const emailPanel =
    isEditable || draft.status === QuoteStatus.SENT ? (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing[2],
          padding: theme.spacing[3],
          border: `1px solid ${theme.border.color.light}`,
          borderRadius: theme.border.radius.md,
        }}
      >
        <span style={{ ...styles.label, flexDirection: 'row', justifyContent: 'space-between' }}>
          Email to client
          {isEmailEdited && (
            <Button variant="ghost" color="neutral" size="sm" onClick={() => setEmailEdits({})}>
              Reset
            </Button>
          )}
        </span>
        {isEditable && (
          <span style={styles.muted}>Preview. The quote number and link are added when you send.</span>
        )}
        <input
          aria-label="Email to"
          placeholder="client@example.com"
          value={email.to}
          onChange={(event) => setEmailEdits((current) => ({ ...current, to: event.target.value }))}
          style={styles.input}
        />
        <input
          aria-label="Email subject"
          value={email.subject}
          onChange={(event) => setEmailEdits((current) => ({ ...current, subject: event.target.value }))}
          style={styles.input}
        />
        <textarea
          aria-label="Email body"
          rows={12}
          value={email.body}
          onChange={(event) => setEmailEdits((current) => ({ ...current, body: event.target.value }))}
          style={styles.textarea}
        />
        {publicUrl && (
          <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
            <Button
              variant="solid"
              color="accent"
              size="sm"
              startIcon={<IconMail size={theme.icon.size.sm} />}
              href={toMailtoUrl(email)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in email app
            </Button>
            <Button
              variant="outline"
              color="neutral"
              size="sm"
              startIcon={<IconCopy size={theme.icon.size.sm} />}
              onClick={copyEmail}
            >
              Copy email
            </Button>
          </div>
        )}
      </div>
    ) : null;

  const reviewPanel = (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          gap: `${theme.spacing[2]} ${theme.spacing[4]}`,
          padding: theme.spacing[3],
          border: `1px solid ${theme.border.color.light}`,
          borderRadius: theme.border.radius.md,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {summaryRow('Client', draft.client.companyName ?? draft.client.contactName ?? '—')}
        {summaryRow(
          'Line items',
          String(draft.lineItems.filter((lineItem) => lineItem.name.trim() !== '').length),
        )}
        {summaryRow('Valid until', draft.expiresAt ? formatShortDate(draft.expiresAt) : 'No expiry')}
        {draft.status === QuoteStatus.SENT &&
          summaryRow('Viewed', draft.viewedAt ? formatDateTime(draft.viewedAt) : 'Not yet')}
        {draft.status === QuoteStatus.ACCEPTED &&
          summaryRow(
            'Accepted',
            [draft.acceptedByName, draft.acceptedAt ? formatDateTime(draft.acceptedAt) : null]
              .filter(Boolean)
              .join(' · ') || '—',
          )}
        {draft.status === QuoteStatus.DECLINED &&
          summaryRow('Declined', draft.declinedAt ? formatDateTime(draft.declinedAt) : '—')}
        {draft.status === QuoteStatus.DECLINED &&
          summaryRow('Reason', draft.declineReason ?? 'No reason given')}
        {summaryRow(
          'Total',
          <strong style={{ fontWeight: theme.font.weight.semiBold }}>{money(totals.totalMicros)}</strong>,
        )}
      </div>

      {isEditable && (
        <span style={styles.muted}>
          Check the preview. Sending locks the quote and gives you a link to share with your client.
        </span>
      )}

      {linkPanel}
      {emailPanel}
      {planBar}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], flexWrap: 'wrap' }}>
        {isEditable ? (
          <Button
            variant="ghost"
            color="neutral"
            size="sm"
            startIcon={<IconArrowLeft size={theme.icon.size.sm} />}
            onClick={() => setStep('edit')}
          >
            Back to edit
          </Button>
        ) : (
          <span />
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
        {(draft.status === QuoteStatus.SENT || draft.status === QuoteStatus.DECLINED) && (
          <Button
            variant="outline"
            color="neutral"
            size="sm"
            loading={isChangingStatus}
            disabled={isChangingStatus}
            onClick={withdraw}
          >
            {draft.status === QuoteStatus.DECLINED ? 'Revise and resend' : 'Withdraw and edit'}
          </Button>
        )}
      </div>
    </>
  );

  return (
    <div style={styles.root}>
      {header}
      {stepBar}
      {step === 'edit'
        ? twoColumns(
            <>
              {editorFields}
              {editActions}
            </>,
            livePreview,
          )
        : twoColumns(
            reviewPanel,
            <>
              <span style={styles.label}>What your client will see</span>
              {previewFrame(isWide ? '760px' : '640px')}
            </>,
            'minmax(280px, 380px)',
          )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: QUOTE_EDITOR_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Quote editor',
  description: 'Line-item editor with live totals for an opportunity quote',
  component: QuoteEditor,
});
