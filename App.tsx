import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatInput from './components/ChatInput';
import ChatMessage from './components/ChatMessage';
import ExpressionAvatar from './components/ExpressionAvatar';
import IntentPicker from './components/IntentPicker';
import PiiNotice from './components/PiiNotice';
import HandoffForm, { HandoffValues } from './components/HandoffForm';
import FallbackNotice from './components/FallbackNotice';
import { Message, Emotion, ContactIntent, AppMode } from './types';
import { useLanguage } from './contexts/LanguageContext';
import { resolveAppMode } from './utils/appMode';
import { getIntentDisplayLabel, parseContactIntent } from './constants/intents';
import {
  isContactChatMock,
  postContactChat,
  postContactChatStart,
  postContactSubmit,
  toApiMessages,
  type Classification as ApiClassification,
  type StructuredLead,
} from './services/contactChatClient';

// Classification re-export helper
type Classif = ApiClassification;

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

const App: React.FC = () => {
  const { locale, setLocale, t } = useLanguage();
  const appMode: AppMode = useMemo(() => resolveAppMode(), []);
  const embedMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('embed') === '1';
  }, []);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>(Emotion.ENJOYING);
  const [selectedIntent, setSelectedIntent] = useState<ContactIntent | null>(() => {
    if (typeof window === 'undefined') return null;
    return parseContactIntent(new URLSearchParams(window.location.search).get('intent'));
  });
  const [sessionId, setSessionId] = useState<string | null>(() => readSessionId(appMode, locale, selectedIntent));
  const idempotencyKeyRef = useRef(uuidv4());
  const initialIntentFromUrlRef = useRef(selectedIntent);
  const autoStartPendingRef = useRef(Boolean(selectedIntent));
  const startAttemptRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [intentStartState, setIntentStartState] = useState<'idle' | 'starting' | 'started'>('idle');
  const [readyForContact, setReadyForContact] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [handoffDraft, setHandoffDraft] = useState<HandoffValues>(EMPTY_HANDOFF_VALUES);
  const [conversationSummary, setConversationSummary] = useState('');
  const [structuredLead, setStructuredLead] = useState<StructuredLead>({});
  const [classification, setClassification] = useState<Classif>('genuine');
  const [apiDegraded, setApiDegraded] = useState(false);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
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
    setHandoffDraft(EMPTY_HANDOFF_VALUES);
    setConversationSummary('');
    setStructuredLead({});
    setSubmitted(false);
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
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
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
        source: 'cloudia',
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
  }, [appMode, beginRequest, finishRequest, intentStartState, locale, sessionId]);

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

    if (appMode === 'intake' && (!selectedIntent || !chatReady)) {
      const notice: Message = {
        id: uuidv4(),
        text: t('selectIntentFirst'),
        sender: 'ai',
        emotion: Emotion.SHY,
      };
      setMessages((prev) => [...prev, notice]);
      setCurrentEmotion(Emotion.SHY);
      return;
    }

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
        source: 'cloudia',
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (result.sessionId) {
        setSessionId(result.sessionId);
        rememberSessionId(appMode, locale, selectedIntent, result.sessionId);
      }
      if (result.summary) setConversationSummary(result.summary);
      if (result.structuredLead) setStructuredLead(result.structuredLead);
      setLastFailedInput(null);
      setApiDegraded(false);
      setClassification(result.classification);
      if (result.readyForContact) {
        setReadyForContact(true);
      }
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
      setMessages((prev) => [
        ...prev,
        { id: uuidv4(), text: t('aiError'), sender: 'ai', emotion: Emotion.SAD },
      ]);
      setCurrentEmotion(Emotion.SAD);
    } finally {
      finishRequest(controller);
    }
  }, [beginRequest, chatReady, finishRequest, messages, locale, t, appMode, selectedIntent, submitted, sessionId]);

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
    if (submitLockRef.current || submitted) return;
    submitLockRef.current = true;
    const controller = beginRequest('submit');
    const handoffMessage = values.message.trim() || conversationSummary.trim() || t('handoffDefaultMessage');
    try {
      await postContactSubmit({
        sessionId,
        idempotencyKey: idempotencyKeyRef.current,
        name: values.name,
        email: values.email,
        company: values.company,
        message: handoffMessage,
        summaryText: conversationSummary,
        structuredLead,
        classification,
        intent: selectedIntent,
        source: 'cloudia',
        website: '',
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setLastFailedInput(null);
      setHandoffDraft(EMPTY_HANDOFF_VALUES);
      setSubmitted(true);
      setShowHandoff(false);
      setMessages((prev) => [
        ...prev,
        { id: uuidv4(), text: t('handoffSuccess'), sender: 'ai', emotion: Emotion.HAPPY },
      ]);
      setCurrentEmotion(Emotion.HAPPY);
      setApiDegraded(false);
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      setApiDegraded(true);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          text: t('aiError'),
          sender: 'ai',
          emotion: Emotion.SAD,
        },
      ]);
      setCurrentEmotion(Emotion.SAD);
    } finally {
      submitLockRef.current = false;
      finishRequest(controller);
    }
  }, [beginRequest, conversationSummary, finishRequest, selectedIntent, structuredLead, classification, sessionId, submitted, t]);

  const displayEmotion = isLoading ? Emotion.THINKING : currentEmotion;
  const shellClass = embedMode
    ? 'flex h-dvh min-h-[520px] w-full overflow-hidden bg-slate-100 text-slate-900'
    : 'flex h-dvh min-h-dvh overflow-hidden bg-slate-100 text-slate-900';

  return (
    <div className={`${shellClass} flex-col`} data-embed={embedMode ? 'true' : 'false'}>
      {!embedMode && (
        <header id="app-header" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 shadow-sm sm:flex-nowrap sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <ExpressionAvatar emotion={displayEmotion} size={48} compact className="shrink-0" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{t('title')}</h1>
              {isContactChatMock() && appMode === 'intake' && (
                <p className="truncate text-xs text-amber-700">contact-chat MOCK</p>
              )}
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
            {(selectedIntent || messages.length > 1 || submitted) && (
              <button
                type="button"
                onClick={handleStartNewConversation}
                className="min-h-11 px-1 text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:text-sm"
              >
                {t('newConversation')}
              </button>
            )}
            <a
              href={buildModeHref(appMode === 'ambassador' ? null : 'ambassador')}
              className="min-h-11 px-1 py-3 text-xs font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:text-sm"
            >
              {t(appMode === 'ambassador' ? 'intakeLink' : 'ambassadorLink')}
            </a>
            <button
              type="button"
              onClick={() => setLocale('en')}
              className={`min-h-11 rounded-lg px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${locale === 'en' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLocale('ja')}
              className={`min-h-11 rounded-lg px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${locale === 'ja' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              日本語
            </button>
          </div>
        </header>
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
          <FallbackNotice
            visible={apiDegraded}
            onRetry={
              intentStartState === 'idle' && selectedIntent
                ? handleRetryStart
                : lastFailedInput
                  ? handleRetryChat
                : undefined
            }
          />

          {isLoading && activeRequest && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-500" role="status">
              <span>{t('thinking')}</span>
              <button
                type="button"
                onClick={handleStopRequest}
                className="min-h-11 px-1 font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                {t('stopRequest')}
              </button>
            </div>
          )}

          <div
            ref={listRef}
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto bg-slate-100 p-3 custom-scrollbar sm:p-5"
            aria-live="polite"
            aria-relevant="additions"
            aria-busy={isLoading}
            role="log"
          >
            {messages.map((msg, index) => (
              <React.Fragment key={msg.id}>
                <ChatMessage message={msg} plainText />
                {appMode === 'intake' && index === 0 && msg.sender === 'ai' && intentStartState !== 'started' && (
                  <div className="ml-10 mt-1 max-w-2xl rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <IntentPicker
                      selected={selectedIntent}
                      onSelect={handleSelectIntent}
                      disabled={isLoading || submitted || intentStartState === 'starting'}
                      describedBy="cloudia-pii-note"
                    />
                    <div id="cloudia-pii-note" className="mt-3">
                      <PiiNotice />
                    </div>
                  </div>
                )}
                {appMode === 'intake' && index === 0 && msg.sender === 'ai' && intentStartState === 'started' && selectedIntent && (
                  <p className="ml-10 mt-0.5 max-w-2xl text-xs text-slate-500" role="status">
                    {t('intentSelected', { label: getIntentDisplayLabel(selectedIntent, locale) })}
                  </p>
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

          {readyForContact && !showHandoff && !submitted && (
            <div className="shrink-0 space-y-2 border-t border-slate-200 bg-white px-4 py-3">
              <p className="text-xs leading-relaxed text-slate-600">{t('readyForContact')}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  onClick={() => setShowHandoff(true)}
                >
                  {t('showHandoff')}
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
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
              onBack={() => setShowHandoff(false)}
              onCancel={handleStartNewConversation}
              onSubmit={handleHandoff}
            />
          )}

          {submitted && (
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
              <button
                type="button"
                className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                onClick={handleStartNewConversation}
              >
                {t('newConversation')}
              </button>
            </div>
          )}

          {!showHandoff && !submitted && (
            <div className="sticky bottom-0 shrink-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:p-4">
              <ChatInput
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                disabled={!chatReady}
                inputRef={inputRef}
                placeholderKey={appMode === 'intake' ? 'typeYourMessageIntake' : 'typeYourMessage'}
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;
