import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatInput from './components/ChatInput';
import ChatMessage from './components/ChatMessage';
import ExpressionAvatar from './components/ExpressionAvatar';
import IntentPicker from './components/IntentPicker';
import PiiNotice from './components/PiiNotice';
import { Message, Emotion, CompanyKnowledge, ContactIntent, AppMode } from './types';
import { askGemini } from './services/geminiService';
import { loadCompanyKnowledge } from './services/knowledgeLoader';
import { useLanguage } from './contexts/LanguageContext';
import { resolveAppMode } from './utils/appMode';
import { getIntentLabel, parseContactIntent } from './constants/intents';

const App: React.FC = () => {
  const { locale, setLocale, t } = useLanguage();
  const appMode: AppMode = useMemo(() => resolveAppMode(), []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>(Emotion.ENJOYING);
  const [companyKnowledge, setCompanyKnowledge] = useState<CompanyKnowledge>({ markdownContent: '', calendarInfo: '' });
  const [selectedIntent, setSelectedIntent] = useState<ContactIntent | null>(() => {
    if (typeof window === 'undefined') return null;
    return parseContactIntent(new URLSearchParams(window.location.search).get('intent'));
  });

  useEffect(() => {
    document.title = t('title');
  }, [t, locale]);

  useEffect(() => {
    const welcomeKey = appMode === 'ambassador' ? 'welcomeMessageAmbassador' : 'welcomeMessage';
    setMessages([{ id: uuidv4(), text: t(welcomeKey), sender: 'ai', emotion: Emotion.ENJOYING }]);
    setCurrentEmotion(Emotion.ENJOYING);
  }, [t, appMode]);

  // Load company knowledge on component mount
  useEffect(() => {
    const loadKnowledge = async () => {
      try {
        const knowledge = await loadCompanyKnowledge();
        setCompanyKnowledge(knowledge);
      } catch (error) {
        console.error('Error loading company knowledge:', error);
        setCompanyKnowledge({
          markdownContent: '# Company Information\nError loading company data.',
          calendarInfo: '## Calendar: Error loading calendar data.',
          companyUrls: []
        });
      }
    };
    loadKnowledge();
  }, []);

  const handleSelectIntent = useCallback((intent: ContactIntent) => {
    setSelectedIntent(intent);
    // URL を同期（共有・埋め込み検証用）。履歴は置き換えのみ。
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('intent', intent);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const handleSendMessage = useCallback(async (inputText: string) => {
    if (!inputText.trim()) return;

    // intake では intent 必須（URL プリセット含む）
    if (appMode === 'intake' && !selectedIntent) {
      const notice: Message = {
        id: uuidv4(),
        text: t('selectIntentFirst'),
        sender: 'ai',
        emotion: Emotion.SHY,
      };
      setMessages(prev => [...prev, notice]);
      setCurrentEmotion(Emotion.SHY);
      return;
    }

    const newUserMessage: Message = { id: uuidv4(), text: inputText, sender: 'user' };
    setMessages(prevMessages => [...prevMessages, newUserMessage]);
    setIsLoading(true);
    setCurrentEmotion(Emotion.THINKING);

    try {
      const { text: aiResponseText, emotion: aiEmotion, sources } = await askGemini(
        inputText,
        companyKnowledge,
        locale,
        appMode,
        selectedIntent,
      );
      const newAiMessage: Message = { id: uuidv4(), text: aiResponseText, sender: 'ai', emotion: aiEmotion, sources };
      setMessages(prevMessages => [...prevMessages, newAiMessage]);
      setCurrentEmotion(aiEmotion);
    } catch (error) {
      console.error("Error getting AI response:", error);
      const errorMessageText = error instanceof Error ? `${t('aiDefaultError')}: ${error.message}` : t('aiError');
      const errorMessage: Message = { id: uuidv4(), text: errorMessageText, sender: 'ai', emotion: Emotion.SAD };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
      setCurrentEmotion(Emotion.SAD);
    } finally {
      setIsLoading(false);
    }
  }, [companyKnowledge, locale, t, appMode, selectedIntent]);

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-gray-900 text-gray-100">
      {/* Header for Language Switcher */}
      <header id="app-header" className="bg-gray-800 shadow-md p-2 flex justify-between items-center gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <ExpressionAvatar emotion={isLoading ? Emotion.THINKING : currentEmotion} size={48} compact className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold truncate">{t('title')}</h1>
            {appMode === 'ambassador' && (
              <p className="text-xs text-gray-400 truncate">ambassador mode</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setLocale('en')}
            className={`px-3 py-1 text-sm rounded ${locale === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}
          >
            English
          </button>
          <button
            onClick={() => setLocale('ja')}
            className={`px-3 py-1 text-sm rounded ${locale === 'ja' ? 'bg-blue-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}
          >
            日本語
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row flex-grow overflow-hidden p-4 gap-6">
        {/* Left / main: Chat */}
        <div className="flex-1 flex flex-col bg-gray-800 rounded-lg shadow-xl overflow-hidden min-h-0">
          <div className="p-4 space-y-3 border-b border-gray-700">
            {appMode === 'intake' && <PiiNotice />}
            {appMode === 'intake' && (
              <IntentPicker
                selected={selectedIntent}
                onSelect={handleSelectIntent}
                disabled={isLoading}
              />
            )}
            {selectedIntent && appMode === 'intake' && (
              <p className="text-xs text-gray-400">
                {t('intentSelected', { label: getIntentLabel(selectedIntent, locale) })}
              </p>
            )}
          </div>
          <div
            className="flex-grow p-4 sm:p-6 space-y-1 overflow-y-auto custom-scrollbar bg-gray-900/40"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <ChatMessage
                key="loading"
                message={{ id: 'loading', text: t('thinking'), sender: 'ai', emotion: Emotion.THINKING }}
              />
            )}
          </div>
          <div className="p-6 border-t border-gray-700">
            <ChatInput
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              placeholderKey={appMode === 'intake' ? 'typeYourMessageIntake' : 'typeYourMessage'}
            />
          </div>
        </div>

        {/* Right: larger avatar (desktop) */}
        <aside className="hidden lg:flex flex-none lg:w-64 xl:w-72 flex-col items-center justify-center bg-gray-800/80 rounded-lg shadow-xl p-6">
          <ExpressionAvatar emotion={isLoading ? Emotion.THINKING : currentEmotion} size={160} />
          <p className="mt-4 text-center text-sm text-gray-400 px-2">
            Cloudia
          </p>
        </aside>
      </div>
    </div>
  );
};

export default App;
