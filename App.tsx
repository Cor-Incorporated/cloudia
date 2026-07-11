import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatInput from './components/ChatInput';
import ChatMessage from './components/ChatMessage';
import ExpressionAvatar from './components/ExpressionAvatar';
import IntentPicker from './components/IntentPicker';
import PiiNotice from './components/PiiNotice';
import HandoffForm, { HandoffValues } from './components/HandoffForm';
import FallbackNotice from './components/FallbackNotice';
import { Message, Emotion, CompanyKnowledge, ContactIntent, AppMode } from './types';
import { loadCompanyKnowledge } from './services/knowledgeLoader';
import { useLanguage } from './contexts/LanguageContext';
import { resolveAppMode } from './utils/appMode';
import { getIntentLabel, parseContactIntent } from './constants/intents';
import {
  buildConversationSummary,
  isContactChatMock,
  postContactChat,
  postContactSubmit,
  toApiMessages,
  type Classification as ApiClassification,
} from './services/contactChatClient';

// Classification re-export helper
type Classif = ApiClassification;

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
  const [companyKnowledge, setCompanyKnowledge] = useState<CompanyKnowledge>({ markdownContent: '', calendarInfo: '' });
  const [selectedIntent, setSelectedIntent] = useState<ContactIntent | null>(() => {
    if (typeof window === 'undefined') return null;
    return parseContactIntent(new URLSearchParams(window.location.search).get('intent'));
  });
  const [readyForContact, setReadyForContact] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [classification, setClassification] = useState<Classif>('genuine');
  const [apiDegraded, setApiDegraded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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
    setSubmitted(false);
  }, [t, appMode]);

  useEffect(() => {
    const loadKnowledge = async () => {
      try {
        const knowledge = await loadCompanyKnowledge();
        setCompanyKnowledge(knowledge);
      } catch {
        setCompanyKnowledge({
          markdownContent: '# Company Information\nError loading company data.',
          calendarInfo: '## Calendar: Error loading calendar data.',
          companyUrls: [],
        });
      }
    };
    loadKnowledge();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading, showHandoff]);

  const handleSelectIntent = useCallback((intent: ContactIntent) => {
    setSelectedIntent(intent);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('intent', intent);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const handleSendMessage = useCallback(async (inputText: string) => {
    if (!inputText.trim() || submitted) return;

    if (appMode === 'intake' && !selectedIntent) {
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
    const nextMessages = [...messages, newUserMessage];
    setMessages(nextMessages);
    setIsLoading(true);
    setCurrentEmotion(Emotion.THINKING);

    try {
      if (appMode === 'ambassador') {
        // 遅延 import で API_KEY 未設定時のモジュール throw を intake 本線から隔離
        const { askGemini } = await import('./services/geminiService');
        const { text: aiResponseText, emotion: aiEmotion, sources } = await askGemini(
          inputText,
          companyKnowledge,
          locale,
          appMode,
          selectedIntent,
        );
        setMessages((prev) => [
          ...prev,
          { id: uuidv4(), text: aiResponseText, sender: 'ai', emotion: aiEmotion, sources },
        ]);
        setCurrentEmotion(aiEmotion);
      } else {
        const apiMessages = toApiMessages(nextMessages);
        // intent を最初の文脈として付与（Worker が system に載せていなくても会話に残る）
        if (selectedIntent && apiMessages.length === 1) {
          apiMessages.unshift({
            role: 'assistant',
            content: `Inquiry intent selected: ${selectedIntent} (${getIntentLabel(selectedIntent, locale)}).`,
          });
        }
        const result = await postContactChat(apiMessages);
        setApiDegraded(false);
        setClassification(result.classification);
        if (result.readyForContact) {
          setReadyForContact(true);
          setShowHandoff(true);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            text: result.reply,
            sender: 'ai',
            emotion: result.readyForContact ? Emotion.ENJOYING : Emotion.EMPATHETIC as Emotion,
          },
        ]);
        // EMPATHETIC was removed — use SHY/ENJOYING
        setCurrentEmotion(result.readyForContact ? Emotion.HAPPY : Emotion.ENJOYING);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setApiDegraded(true);
      const errorMessageText =
        error instanceof Error ? `${t('aiDefaultError')}: ${error.message}` : t('aiError');
      setMessages((prev) => [
        ...prev,
        { id: uuidv4(), text: errorMessageText, sender: 'ai', emotion: Emotion.SAD },
      ]);
      setCurrentEmotion(Emotion.SAD);
    } finally {
      setIsLoading(false);
    }
  }, [messages, companyKnowledge, locale, t, appMode, selectedIntent, submitted]);

  // Fix emotion: remove EMPATHETIC cast - I already set ENJOYING/HAPPY above but left a bad cast in message - fix App
  const handleHandoff = useCallback(async (values: HandoffValues) => {
    setIsLoading(true);
    try {
      const summary = buildConversationSummary(messages, selectedIntent);
      await postContactSubmit({
        name: values.name,
        email: values.email,
        company: values.company,
        message: values.message || summary.slice(0, 500),
        conversationSummary: summary,
        classification,
        intent: selectedIntent,
        source: 'cloudia',
        website: '',
      });
      setSubmitted(true);
      setShowHandoff(false);
      setMessages((prev) => [
        ...prev,
        { id: uuidv4(), text: t('handoffSuccess'), sender: 'ai', emotion: Emotion.HAPPY },
      ]);
      setCurrentEmotion(Emotion.HAPPY);
      setApiDegraded(false);
    } catch (error) {
      console.error('Submit error:', error);
      setApiDegraded(true);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          text: error instanceof Error ? `${t('aiDefaultError')}: ${error.message}` : t('aiError'),
          sender: 'ai',
          emotion: Emotion.SAD,
        },
      ]);
      setCurrentEmotion(Emotion.SAD);
    } finally {
      setIsLoading(false);
    }
  }, [messages, selectedIntent, classification, t]);

  const displayEmotion = isLoading ? Emotion.THINKING : currentEmotion;

  return (
    <div className={`flex flex-col h-screen max-h-screen overflow-hidden bg-gray-900 text-gray-100 ${embedMode ? 'pt-0' : ''}`} style={embedMode ? { paddingTop: 0 } : undefined}>
      {!embedMode && (
        <header id="app-header" className="bg-gray-800 shadow-md p-2 flex justify-between items-center gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <ExpressionAvatar emotion={displayEmotion} size={48} compact className="shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold truncate">{t('title')}</h1>
              {appMode === 'ambassador' && (
                <p className="text-xs text-gray-400 truncate">ambassador mode</p>
              )}
              {isContactChatMock() && appMode === 'intake' && (
                <p className="text-xs text-amber-400 truncate">contact-chat MOCK</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setLocale('en')}
              className={`px-3 py-1 text-sm rounded ${locale === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLocale('ja')}
              className={`px-3 py-1 text-sm rounded ${locale === 'ja' ? 'bg-blue-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}
            >
              日本語
            </button>
          </div>
        </header>
      )}

      {embedMode && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-b border-gray-700">
          <ExpressionAvatar emotion={displayEmotion} size={36} compact />
          <span className="text-sm font-medium truncate">{t('title')}</span>
        </div>
      )}

      <div className={`flex flex-col lg:flex-row flex-grow overflow-hidden p-2 sm:p-4 gap-4 ${embedMode ? '' : ''}`}>
        <div className="flex-1 flex flex-col bg-gray-800 rounded-lg shadow-xl overflow-hidden min-h-0">
          {appMode === 'intake' && (
            <div className="p-3 sm:p-4 space-y-3 border-b border-gray-700 shrink-0">
              <PiiNotice />
              <IntentPicker selected={selectedIntent} onSelect={handleSelectIntent} disabled={isLoading || submitted} />
              {selectedIntent && (
                <p className="text-xs text-gray-400">
                  {t('intentSelected', { label: getIntentLabel(selectedIntent, locale) })}
                </p>
              )}
            </div>
          )}

          <FallbackNotice visible={apiDegraded} />

          <div
            ref={listRef}
            className="flex-grow p-3 sm:p-4 space-y-1 overflow-y-auto custom-scrollbar bg-gray-900/40"
            aria-live="polite"
            aria-relevant="additions"
            role="log"
          >
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} plainText />
            ))}
            {isLoading && (
              <ChatMessage
                message={{ id: 'loading', text: t('thinking'), sender: 'ai', emotion: Emotion.THINKING }}
                plainText
              />
            )}
          </div>

          {appMode === 'intake' && readyForContact && !showHandoff && !submitted && (
            <div className="px-4 py-2 border-t border-gray-700">
              <button
                type="button"
                className="text-sm text-blue-400 underline"
                onClick={() => setShowHandoff(true)}
              >
                {t('showHandoff')}
              </button>
            </div>
          )}

          {appMode === 'intake' && showHandoff && !submitted && (
            <HandoffForm disabled={isLoading} onSubmit={handleHandoff} />
          )}

          {!showHandoff && !submitted && (
            <div className="p-3 sm:p-4 border-t border-gray-700 shrink-0">
              <ChatInput
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                placeholderKey={appMode === 'intake' ? 'typeYourMessageIntake' : 'typeYourMessage'}
              />
            </div>
          )}
        </div>

        {!embedMode && (
          <aside className="hidden lg:flex flex-none lg:w-64 xl:w-72 flex-col items-center justify-center bg-gray-800/80 rounded-lg shadow-xl p-6">
            <ExpressionAvatar emotion={displayEmotion} size={160} />
            <p className="mt-4 text-center text-sm text-gray-400 px-2">Cloudia</p>
          </aside>
        )}
      </div>
    </div>
  );
};

export default App;
