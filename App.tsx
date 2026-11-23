import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatInput from './components/ChatInput';
import ChatMessage from './components/ChatMessage';
import ExpressionAvatar from './components/ExpressionAvatar';
import IntentPicker from './components/IntentPicker';
import PiiNotice from './components/PiiNotice';
import PrivacyPolicyLink from './components/PrivacyPolicyLink';
import IntroPanel from './components/IntroPanel';
import SiteHeader from './components/SiteHeader';
import SiteFooterBar from './components/SiteFooterBar';
import HandoffForm, { HandoffValues } from './components/HandoffForm';
import FallbackNotice from './components/FallbackNotice';
import FaqResolutionPrompt from './components/FaqResolutionPrompt';
import { Message, Emotion, ContactIntent, AppMode } from './types';
import { useLanguage } from './contexts/LanguageContext';
import { resolveAppMode } from './utils/appMode';
import { chatPlaceholderKey, displayThread, handoffSuccessMessage, messageListScrollTarget, showNewConversation } from './utils/chatView';
import {
  classifyReturnTarget,
  persistReturnTarget,
  readStoredReturnTarget,
  resolveReturnTarget,
  RETURN_LINK_LABEL_KEYS,
  safeSessionStorage,
} from './utils/returnTarget';
import { getIntentDisplayLabel, parseContactIntent } from './constants/intents';
import { parseEntrySourceFromSearch } from './constants/entrySources';
import { historyHasIndustryReception, industryLabel, industryOpening, industryPrivacyBoundary, industryQuestion } from './constants/industryGuidance';
import { showDirectHandoff, showReadyHandoff } from './utils/inquiryPath';
import {
  isContactChatMock,
  postContactChat,
  postContactChatStart,
  toApiMessages,
  type Classification as ApiClassification,
  type StructuredLead,
  type ChatResult,
} from './services/contactChatClient';
import { translations } from './translations';
import { submitContactInquiry } from './services/submitWithAnalytics';

// Classification re-export helper
type Classif = ApiClassification;

// Match the visible action in either UI language as well as common request-only replies.
const handoffLabels = Object.values(translations).map((copy) => copy.showHandoff.toLowerCase());
const japaneseHandoff = /^(?:(?:お?問い合わせ(?:を?し)?|(?:担当(?:者|の方)?|スタッフ)に(?:相談|連絡)し)たい(?:です)?|(?:担当(?:者)?への)?(?:相談|問い合わせ)(?:を希望(?:します)?|希望))$/;
const englishHandoff = /^i (?:want|would like) to (?:contact (?:you|the team)|make an inquiry|speak (?:with|to) (?:someone|a representative))$/;

function isHandoffRequest(text: string): boolean {
  const phrase = text.trim().replace(/[。.!！]+$/, '').toLowerCase();
  return handoffLabels.includes(phrase) || japaneseHandoff.test(phrase) || englishHandoff.test(phrase);
}

function usableHandoffSummary(value: string): boolean {
  const summary = value.trim();
  return Boolean(summary) && !/^(?:要約未生成|Summary unavailable)/i.test(summary) &&
    !isHandoffRequest(summary);
}

const EMPTY_HANDOFF_VALUES: HandoffValues = {
  name: '',
  email: '',
  company: '',
  message: '',
};

function sessionStorageKey(mode: AppMode, locale: string, intent: ContactIntent | null): string {
  return `cloudia:contact-session:${mode}:${locale}:${intent ?? 'none'}`;
}

function readSessionId(mode: AppMode, locale: string, intent: ContactIntent | null): string | null {
  if (typeof window === 'undefined' || !intent) return null;
  try {
    const value = window.sessionStorage.getItem(sessionStorageKey(mode, locale, intent));
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function rememberSessionId(mode: AppMode, locale: string, intent: ContactIntent | null, sessionId: string): void {
  if (typeof window === 'undefined' || !intent || !sessionId.trim()) return;
  try {
    window.sessionStorage.setItem(sessionStorageKey(mode, locale, intent), sessionId.trim());
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function forgetSessionId(mode: AppMode, locale: string, intent: ContactIntent | null): void {
  if (typeof window === 'undefined' || !intent) return;
  try {
    window.sessionStorage.removeItem(sessionStorageKey(mode, locale, intent));
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function shouldPromptFaqResolution(result: ChatResult): boolean {
  return result.faqResolution === 'unresolved';
}

function isFaqFullyResolved(result: ChatResult): boolean {
  return result.faqResolution === 'answered';
}

const App: React.FC = () => {
  const { locale, setLocale, t } = useLanguage();
  const appMode: AppMode = useMemo(() => resolveAppMode(), []);
  const embedMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('embed') === '1';
  }, []);

  // 戻る先。同じ tab の間は、mode の切り替えや再読み込みの後も同じ先を使う
  // （chat の中の遷移で取り直さない）。embed（枠の中）では戻る link を出さない。
  // 決定は純関数（utils/returnTarget.ts）で行い、useMemo の中では storage に書かない。
  const returnDecision = useMemo(() => {
    if (embedMode || typeof window === 'undefined') return null;
    return resolveReturnTarget(
      typeof document === 'undefined' ? null : document.referrer,
      window.location.href,
      locale,
      readStoredReturnTarget(safeSessionStorage()),
    );
  }, [embedMode, locale]);
  const returnHref = returnDecision?.href ?? null;
  const returnLabelKind = returnHref ? classifyReturnTarget(returnHref) : null;
  const returnLabelKey = returnLabelKind ? RETURN_LINK_LABEL_KEYS[returnLabelKind] : null;

  useEffect(() => {
    if (!returnDecision || typeof window === 'undefined') return;
    persistReturnTarget(returnDecision, safeSessionStorage());
  }, [returnDecision]);

  // 初回描画から最初の吹き出しを出す（effects が走らない静的描画・埋込初回でも空画面にしない）。
  // text は常に汎用の挨拶。業態入口の専用コピーへの差し替えは描画時（displayThread）のみ。
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: uuidv4(),
      text: t(appMode === 'ambassador' ? 'welcomeMessageAmbassador' : 'welcomeMessage'),
      sender: 'ai',
      emotion: Emotion.ENJOYING,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>(Emotion.ENJOYING);
  const [selectedIntent, setSelectedIntent] = useState<ContactIntent | null>(() => {
    if (typeof window === 'undefined') return null;
    return parseContactIntent(new URLSearchParams(window.location.search).get('intent'));
  });
  // Read after startAnalytics() has already dropped anything that is not an allow-listed source.
  const entrySource = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return parseEntrySourceFromSearch(window.location.search);
  }, []);
  // 見出しと最初の問いは画面表示専用。messages と API への送信内容は変えない。
  const industryQuestionText = appMode === 'intake' ? industryQuestion(entrySource, locale) : null;
  const industryName = industryQuestionText ? industryLabel(entrySource, locale) : null;
  const industryBoundaryText = appMode === 'intake' ? industryPrivacyBoundary(entrySource, locale) : null;
  const [sessionId, setSessionId] = useState<string | null>(() => readSessionId(appMode, locale, selectedIntent));
  const idempotencyKeyRef = useRef(uuidv4());
  const initialIntentFromUrlRef = useRef(selectedIntent);
  const autoStartPendingRef = useRef(Boolean(selectedIntent));
  const startAttemptRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const handoffEntryRef = useRef<HTMLButtonElement>(null);
  const returnToHandoffEntryRef = useRef(false);
  const [intentStartState, setIntentStartState] = useState<'idle' | 'starting' | 'started'>('idle');
  const [readyForContact, setReadyForContact] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [handoffFailed, setHandoffFailed] = useState(false);
  const [handoffDraft, setHandoffDraft] = useState<HandoffValues>(EMPTY_HANDOFF_VALUES);
  const [conversationSummary, setConversationSummary] = useState('');
  const [structuredLead, setStructuredLead] = useState<StructuredLead>({});
  const [classification, setClassification] = useState<Classif>('genuine');
  const [apiDegraded, setApiDegraded] = useState(false);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [faqResolved, setFaqResolved] = useState(false);
  const [showFaqPrompt, setShowFaqPrompt] = useState(false);
  const [activeRequest, setActiveRequest] = useState<'start' | 'chat' | 'submit' | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const submitLockRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = t('title');
  }, [t, locale]);

  useEffect(() => {
    const welcomeKey = appMode === 'ambassador' ? 'welcomeMessageAmbassador' : 'welcomeMessage';
    setMessages([{ id: uuidv4(), text: t(welcomeKey), sender: 'ai', emotion: Emotion.ENJOYING }]);
    setCurrentEmotion(Emotion.ENJOYING);
    setReadyForContact(false);
    setShowHandoff(false);
    setHandoffFailed(false);
    setHandoffDraft(EMPTY_HANDOFF_VALUES);
    setConversationSummary('');
    setStructuredLead({});
    setSubmitted(false);
    setFaqResolved(false);
    setShowFaqPrompt(false);
    setSessionId(readSessionId(appMode, locale, selectedIntent));
    idempotencyKeyRef.current = uuidv4();
    setIntentStartState('idle');
    startAttemptRef.current = null;
    if (initialIntentFromUrlRef.current) {
      autoStartPendingRef.current = true;
    }
  }, [t, appMode]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const chatReady = appMode === 'ambassador' || intentStartState === 'started';

  useEffect(() => {
    if (!chatReady || isLoading) return;
    inputRef.current?.focus();
  }, [chatReady, isLoading]);

  useEffect(() => {
    if (showHandoff || !returnToHandoffEntryRef.current) return;
    returnToHandoffEntryRef.current = false;
    handoffEntryRef.current?.focus();
  }, [showHandoff]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (messageListScrollTarget(messages.length, isLoading, showHandoff) === 'top') {
      list.scrollTo({ top: 0 });
      return;
    }
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading, showHandoff]);

  const beginRequest = useCallback((kind: 'start' | 'chat' | 'submit'): AbortController => {
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    setActiveRequest(kind);
    setIsLoading(true);
    return controller;
  }, []);

  const finishRequest = useCallback((controller: AbortController) => {
    if (requestAbortRef.current !== controller) return;
    requestAbortRef.current = null;
    setActiveRequest(null);
    setIsLoading(false);
  }, []);

  const handleStopRequest = useCallback(() => {
    const controller = requestAbortRef.current;
    if (!controller) return;
    const requestKind = activeRequest;
    controller.abort();
    requestAbortRef.current = null;
    setActiveRequest(null);
    setIsLoading(false);
    setApiDegraded(false);
    setCurrentEmotion(Emotion.ENJOYING);
    if (requestKind === 'start') {
      startAttemptRef.current = null;
      setIntentStartState('idle');
    }
  }, [activeRequest]);

  const markFaqResolved = useCallback(() => {
    setShowFaqPrompt(false);
    setFaqResolved(true);
    setReadyForContact(false);
    setShowHandoff(false);
    setMessages((prev) => [
      ...prev,
      { id: uuidv4(), text: t('faqResolvedThanks'), sender: 'ai', emotion: Emotion.HAPPY },
    ]);
    setCurrentEmotion(Emotion.HAPPY);
  }, [t]);

  const applyFaqResolutionFromResult = useCallback((result: ChatResult) => {
    if (isFaqFullyResolved(result)) {
      markFaqResolved();
      return;
    }
    setShowFaqPrompt(shouldPromptFaqResolution(result));
  }, [markFaqResolved]);

  const startConversation = useCallback(async (intent: ContactIntent, requestedSessionId = sessionId) => {
    const attemptKey = `${locale}:${intent}`;
    if (startAttemptRef.current === attemptKey || intentStartState === 'started') return;

    startAttemptRef.current = attemptKey;
    setIntentStartState('starting');
    const controller = beginRequest('start');
    setApiDegraded(false);
    setLastFailedInput(null);
    setCurrentEmotion(Emotion.THINKING);

    try {
      const result = await postContactChatStart(toApiMessages(messagesRef.current), {
        mode: appMode,
        locale,
        intent,
        sessionId: requestedSessionId,
        entrySource,
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (result.sessionId) {
        setSessionId(result.sessionId);
        rememberSessionId(appMode, locale, intent, result.sessionId);
      }
      if (result.summary) setConversationSummary(result.summary);
      if (result.structuredLead) setStructuredLead(result.structuredLead);
      setClassification(result.classification);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          text: result.reply,
          sender: 'ai',
          emotion: result.readyForContact ? Emotion.HAPPY : Emotion.ENJOYING,
        },
      ]);
      if (result.readyForContact) {
        setReadyForContact(true);
      }
      applyFaqResolutionFromResult(result);
      setIntentStartState('started');
      setCurrentEmotion(result.readyForContact ? Emotion.HAPPY : Emotion.ENJOYING);
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      startAttemptRef.current = null;
      setIntentStartState('idle');
      setApiDegraded(true);
      setCurrentEmotion(Emotion.SAD);
    } finally {
      finishRequest(controller);
    }
  }, [appMode, applyFaqResolutionFromResult, beginRequest, entrySource, finishRequest, intentStartState, locale, sessionId]);

  const handleSelectIntent = useCallback((intent: ContactIntent) => {
    const requestedSessionId = selectedIntent === intent ? sessionId : null;
    if (selectedIntent !== intent) setSessionId(null);
    setSelectedIntent(intent);
    autoStartPendingRef.current = false;
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('intent', intent);
      window.history.replaceState({}, '', url.toString());
    }
    void startConversation(intent, requestedSessionId);
  }, [selectedIntent, sessionId, startConversation]);

  useEffect(() => {
    if (
      appMode !== 'intake' ||
      !selectedIntent ||
      messages.length === 0 ||
      !autoStartPendingRef.current ||
      intentStartState !== 'idle'
    ) {
      return;
    }
    autoStartPendingRef.current = false;
    void startConversation(selectedIntent);
  }, [appMode, intentStartState, messages.length, selectedIntent, startConversation]);

  const handleRetryStart = useCallback(() => {
    if (selectedIntent) void startConversation(selectedIntent);
  }, [selectedIntent, startConversation]);

  const handleSendMessage = useCallback(async (inputText: string, retrying = false) => {
    if (!inputText.trim() || submitted) return;

    if (requestAbortRef.current) return;

    const newUserMessage: Message = { id: uuidv4(), text: inputText, sender: 'user' };
    const nextMessages = retrying ? messages : [...messages, newUserMessage];
    if (!retrying) setMessages(nextMessages);
    if (!retrying) setLastFailedInput(null);
    const controller = beginRequest('chat');
    setCurrentEmotion(Emotion.THINKING);

    try {
      const apiMessages = toApiMessages(nextMessages);
      const result = await postContactChat(apiMessages, {
        mode: appMode,
        locale,
        intent: selectedIntent,
        sessionId,
        entrySource,
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (result.sessionId) {
        setSessionId(result.sessionId);
        rememberSessionId(appMode, locale, selectedIntent, result.sessionId);
      }
      const { summary } = result;
      if (summary) {
        setConversationSummary((current) =>
          industryName && isHandoffRequest(inputText) && usableHandoffSummary(current)
            ? current
            : summary,
        );
      }
      if (result.structuredLead) setStructuredLead(result.structuredLead);
      setLastFailedInput(null);
      setApiDegraded(false);
      if (appMode === 'intake') setIntentStartState('started');
      setClassification(result.classification);
      if (result.readyForContact) {
        setReadyForContact(true);
      }
      applyFaqResolutionFromResult(result);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          text: result.reply,
          sender: 'ai',
          emotion: result.readyForContact ? Emotion.HAPPY : Emotion.ENJOYING,
        },
      ]);
      setCurrentEmotion(result.readyForContact ? Emotion.HAPPY : Emotion.ENJOYING);
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      setLastFailedInput(inputText);
      setApiDegraded(true);
      setCurrentEmotion(Emotion.SAD);
    } finally {
      finishRequest(controller);
    }
  }, [applyFaqResolutionFromResult, beginRequest, entrySource, finishRequest, industryName, messages, locale, appMode, selectedIntent, submitted, sessionId]);

  const handleRetryChat = useCallback(() => {
    if (lastFailedInput) void handleSendMessage(lastFailedInput, true);
  }, [handleSendMessage, lastFailedInput]);

  const buildModeHref = useCallback((mode: AppMode | null): string => {
    if (typeof window === 'undefined') return mode === 'ambassador' ? '/contact/chat/ambassador/' : '/contact/chat/';
    const url = new URL(window.location.href);
    const productionHost = window.location.hostname === 'cor-jp.com';
    url.pathname = mode === 'ambassador' && productionHost ? '/contact/chat/ambassador/' : '/contact/chat/';
    url.searchParams.delete('mode');
    if (mode === 'ambassador' && !productionHost) url.searchParams.set('mode', 'ambassador');
    url.searchParams.delete('intent');
    return `${url.pathname}${url.search}${url.hash}`;
  }, []);

  const handleStartNewConversation = useCallback(() => {
    if (!submitted && messages.length > 1 && typeof window !== 'undefined' && !window.confirm(t('newConversationConfirm'))) {
      return;
    }

    handleStopRequest();
    setHandoffFailed(false);
    forgetSessionId(appMode, locale, selectedIntent);
    setSelectedIntent(null);
    setSessionId(null);
    setMessages([{
      id: uuidv4(),
      text: t(appMode === 'ambassador' ? 'welcomeMessageAmbassador' : 'welcomeMessage'),
      sender: 'ai',
      emotion: Emotion.ENJOYING,
    }]);
    setCurrentEmotion(Emotion.ENJOYING);
    setReadyForContact(false);
    setShowHandoff(false);
    setHandoffDraft(EMPTY_HANDOFF_VALUES);
    setConversationSummary('');
    setStructuredLead({});
    setClassification('genuine');
    setApiDegraded(false);
    setLastFailedInput(null);
    setSubmitted(false);
    setFaqResolved(false);
    setShowFaqPrompt(false);
    setIntentStartState('idle');
    startAttemptRef.current = null;
    initialIntentFromUrlRef.current = null;
    autoStartPendingRef.current = false;
    idempotencyKeyRef.current = uuidv4();
    submitLockRef.current = false;
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('intent');
      window.history.replaceState({}, '', url.toString());
    }
  }, [appMode, handleStopRequest, locale, messages.length, selectedIntent, submitted, t]);

  const handleHandoff = useCallback(async (values: HandoffValues) => {
    if (submitLockRef.current || submitted || !values.message.trim()) return;
    submitLockRef.current = true;
    setHandoffFailed(false);
    const controller = beginRequest('submit');
    try {
      let submissionSessionId = sessionId;
      // The Worker derives the industry from its stored session when it accepts an inquiry.
      if (!submissionSessionId && industryName && !isContactChatMock()) {
        const started = await postContactChatStart([], {
          mode: appMode,
          locale,
          intent: selectedIntent,
          sessionId: null,
          entrySource,
        }, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!started.sessionId) throw new Error('Contact session was not created');
        submissionSessionId = started.sessionId;
        setSessionId(submissionSessionId);
      }
      const submitResult = await submitContactInquiry({
        sessionId: submissionSessionId,
        idempotencyKey: idempotencyKeyRef.current,
        name: values.name,
        email: values.email,
        company: values.company,
        message: values.message.trim(),
        summaryText: industryName ? values.message.trim() : conversationSummary,
        structuredLead: industryName ? undefined : structuredLead,
        classification,
        intent: selectedIntent,
        entrySource,
        website: '',
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setLastFailedInput(null);
      setHandoffDraft(EMPTY_HANDOFF_VALUES);
      setSubmitted(true);
      setShowHandoff(false);
      const success = handoffSuccessMessage(submitResult.receiptId);
      setMessages((prev) => [
        ...prev,
        { id: uuidv4(), text: t(success.textKey, success.replacements), sender: 'ai', emotion: Emotion.HAPPY },
      ]);
      setCurrentEmotion(Emotion.HAPPY);
      setApiDegraded(false);
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      setHandoffFailed(true);
      setCurrentEmotion(Emotion.SAD);
    } finally {
      submitLockRef.current = false;
      finishRequest(controller);
    }
  }, [appMode, beginRequest, conversationSummary, entrySource, finishRequest, industryName, locale, selectedIntent, structuredLead, classification, sessionId, submitted, t]);

  const displayEmotion = isLoading ? Emotion.THINKING : currentEmotion;
  const pathInput = {
    appMode,
    submitted,
    showHandoff,
    readyForContact,
    faqResolved,
    showFaqPrompt,
    classification,
  };
  const readyHandoffVisible = showReadyHandoff(pathInput);
  const directHandoffVisible = showDirectHandoff(pathInput) && (Boolean(industryQuestionText) || messages.length > 1 || apiDegraded);
  const openHandoff = () => {
    const userMessages = messages.filter((message) => message.sender === 'user').reverse();
    const lastUserText = userMessages[0]?.text ?? '';
    const summary = conversationSummary.trim();
    const canUseSummary = industryName
      ? usableHandoffSummary(summary) && (readyForContact ||
        (classification === 'genuine' && userMessages.length > 0))
      : readyForContact;
    const fallback = industryName && isHandoffRequest(lastUserText)
      ? userMessages.find((message) => !isHandoffRequest(message.text))?.text ?? lastUserText
      : lastUserText;
    setHandoffDraft((draft) => ({
      ...draft,
      message: draft.message || (canUseSummary ? summary : '') || fallback,
    }));
    setShowHandoff(true);
  };
  const thread = displayThread(messages, {
    openingText: industryQuestionText,
    dropOpening: intentStartState === 'started' && historyHasIndustryReception(messages, entrySource, locale),
  });
  const showOpeningPrivacy = thread[0]?.id === messages[0]?.id;
  const medicalWorkerOpening = entrySource === 'industry-medical' && !showOpeningPrivacy
    ? industryOpening(entrySource, locale)
    : null;
  const shellClass = embedMode
    ? 'flex h-dvh min-h-0 w-full overflow-hidden bg-white text-slate-900'
    : 'flex h-dvh min-h-dvh overflow-hidden bg-white text-slate-900';

  return (
    <div className={`${shellClass} flex-col`} data-embed={embedMode ? 'true' : 'false'}>
      {!embedMode && (
        <SiteHeader
          emotion={displayEmotion}
          returnHref={returnHref}
          returnLabel={returnHref && returnLabelKey ? t(returnLabelKey) : null}
          locale={locale}
          onSelectLocale={setLocale}
          contentHasHeading={Boolean(industryName) || showHandoff}
          showMockBadge={isContactChatMock() && appMode === 'intake'}
        />
      )}

      {embedMode && (
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
          <ExpressionAvatar emotion={displayEmotion} size={36} compact />
          <span className="truncate text-sm font-medium text-slate-900">{t('title')}</span>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <section
          className={`mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col bg-white shadow-sm ${showHandoff ? 'overflow-y-auto' : 'overflow-hidden'}`}
        >
          {!showHandoff && showNewConversation({ selectedIntent, messageCount: messages.length, submitted }) && (
            <div
              data-testid="conversation-actions"
              className="flex min-h-11 shrink-0 items-center justify-end px-3 pt-1"
            >
              <button
                type="button"
                onClick={handleStartNewConversation}
                className="min-h-11 text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
              >
                {t('newConversation')}
              </button>
            </div>
          )}

          {isLoading && activeRequest && !showHandoff && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-500" role="status">
              <span>{t('thinking')}</span>
              <button
                type="button"
                onClick={handleStopRequest}
                className="min-h-11 px-1 font-medium text-navy underline underline-offset-2 hover:text-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
              >
                {t('stopRequest')}
              </button>
            </div>
          )}

          <div
            ref={listRef}
            className={`${showHandoff ? 'hidden' : 'flex'} min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-white p-3 custom-scrollbar sm:p-5`}
            aria-live="polite"
            aria-relevant="additions"
            aria-busy={isLoading}
            role="log"
          >
            {industryName && (
              <h1 className="text-balance text-lg font-semibold leading-tight text-slate-950 sm:text-2xl">
                {t('industryConsultationTitle', { industry: industryName })}
              </h1>
            )}
            {thread.map((msg, index) => (
              <React.Fragment key={msg.id}>
                {industryQuestionText && index === 0 && msg.text === industryQuestionText ? (
                  <p className="text-pretty text-base leading-relaxed text-slate-800">{msg.text}</p>
                ) : (
                  <ChatMessage
                    message={medicalWorkerOpening && msg.sender === 'ai' && industryBoundaryText
                      ? { ...msg, text: msg.text.replace(medicalWorkerOpening, industryBoundaryText) }
                      : msg}
                    plainText
                  />
                )}
                {appMode === 'intake' && index === 0 && msg.id === messages[0]?.id && (
                  <div className="mt-2 max-w-2xl space-y-3">
                    <div id="cloudia-pii-note">
                      <PiiNotice note={industryBoundaryText ?? undefined} compact={entrySource === 'industry-medical'} />
                    </div>
                    {messages.length === 1 && (
                      <IntentPicker
                        selected={selectedIntent}
                        onSelect={handleSelectIntent}
                        disabled={isLoading || submitted || intentStartState === 'starting'}
                        describedBy="cloudia-pii-note"
                      />
                    )}
                  </div>
                )}
                {appMode === 'intake' && index === 0 && msg.sender === 'ai' && intentStartState === 'started' && selectedIntent && (
                  <p className="ml-10 mt-0.5 max-w-2xl text-xs text-slate-600" role="status">
                    {t('intentSelected', { label: getIntentDisplayLabel(selectedIntent, locale) })}
                  </p>
                )}
                {index === 0 && msg.sender === 'ai' && !showHandoff && !submitted && (appMode !== 'intake' || intentStartState !== 'started') && (
                  <IntroPanel
                    mode={appMode}
                    modeSwitchHref={buildModeHref(appMode === 'ambassador' ? null : 'ambassador')}
                    calendarTarget={embedMode ? '_top' : undefined}
                  />
                )}
              </React.Fragment>
            ))}
            {isLoading && (
              <ChatMessage
                message={{ id: 'loading', text: t('thinking'), sender: 'ai', emotion: Emotion.THINKING }}
                plainText
              />
            )}
          </div>

          {showFaqPrompt && !faqResolved && !submitted && (
            <FaqResolutionPrompt
              disabled={isLoading}
              onResolved={markFaqResolved}
              onUnresolved={() => {
                setShowFaqPrompt(false);
                inputRef.current?.focus();
              }}
            />
          )}

          {readyHandoffVisible && (
            <div className="shrink-0 space-y-2 border-t border-slate-200 bg-white px-4 py-3">
              <p className="text-xs leading-relaxed text-slate-600">{t('readyForContact')}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  ref={handoffEntryRef}
                  type="button"
                  className="min-h-11 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                  onClick={openHandoff}
                >
                  {t('showHandoff')}
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                  onClick={() => inputRef.current?.focus()}
                >
                  {t('continueChat')}
                </button>
              </div>
            </div>
          )}

          {showHandoff && !submitted && (
            <HandoffForm
              values={handoffDraft}
              onChange={setHandoffDraft}
              disabled={isLoading}
              submitFailed={handoffFailed}
              onBack={() => {
                returnToHandoffEntryRef.current = true;
                setHandoffFailed(false);
                setShowHandoff(false);
              }}
              onCancel={handleStartNewConversation}
              onSubmit={handleHandoff}
            />
          )}

          {faqResolved && (
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
              <button
                type="button"
                className="min-h-11 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                onClick={handleStartNewConversation}
              >
                {t('newConversation')}
              </button>
            </div>
          )}

          {submitted && (
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
              <button
                type="button"
                className="min-h-11 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                onClick={handleStartNewConversation}
              >
                {t('newConversation')}
              </button>
            </div>
          )}

          <FallbackNotice
            visible={apiDegraded && !showHandoff}
            onRetry={
              intentStartState === 'idle' && selectedIntent
                ? handleRetryStart
                : lastFailedInput
                  ? handleRetryChat
                  : undefined
            }
          />

          {directHandoffVisible && (
            <div className="flex shrink-0 items-center border-t border-slate-200 bg-white px-3 sm:px-5">
              <button
                ref={handoffEntryRef}
                type="button"
                onClick={openHandoff}
                disabled={isLoading}
                className="min-h-11 text-left text-sm font-medium text-navy underline underline-offset-2 hover:text-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:text-slate-400"
              >
                {t(messages.length > 1 ? 'showHandoff' : 'skipChatHandoff')}
              </button>
            </div>
          )}

          {!submitted && !faqResolved && (
            <div hidden={showHandoff} className="shrink-0 border-t border-slate-200 bg-white px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4">
              <ChatInput
                key={idempotencyKeyRef.current}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                describedBy={appMode === 'intake' ? showOpeningPrivacy ? 'cloudia-pii-note' : 'cloudia-chat-privacy' : undefined}
                inputRef={inputRef}
                placeholderKey={chatPlaceholderKey(appMode)}
              />
              {appMode === 'intake' && !showOpeningPrivacy && (
                <p id="cloudia-chat-privacy" className="mt-1 text-xs text-slate-600">
                  <PrivacyPolicyLink label={t('chatPrivacyReminder')} />
                </p>
              )}
            </div>
          )}
        </section>
      </main>

      {!embedMode && <SiteFooterBar currentSite="cloudia" />}
    </div>
  );
};

export default App;
