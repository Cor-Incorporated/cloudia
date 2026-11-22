import React, { useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import type { ChatPlaceholderKey } from '../utils/chatView';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  canSend?: boolean;
  describedBy?: string;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  placeholderKey?: ChatPlaceholderKey;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  canSend = true,
  describedBy,
  disabled = false,
  inputRef,
  placeholderKey = 'typeYourMessage',
}) => {
  const [inputText, setInputText] = useState('');
  const composing = useRef(false);
  const { t } = useLanguage();
  const placeholder = t(placeholderKey);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (composing.current || !inputText.trim() || isLoading || disabled || !canSend) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const isDisabled = isLoading || disabled;

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-3xl items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; }}
        placeholder={placeholder}
        className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-500 bg-white px-3 py-2 text-base text-slate-900 outline-none transition-shadow placeholder:text-slate-500 focus:border-navy focus:ring-2 focus:ring-navy/20 disabled:cursor-not-allowed disabled:bg-slate-100"
        disabled={isDisabled}
        aria-label={placeholder}
        aria-describedby={describedBy}
      />
      <button
        type="submit"
        aria-label={t('sendMessage')}
        disabled={isDisabled || !canSend}
        className="min-h-11 shrink-0 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : t('sendMessage')}
      </button>
    </form>
  );
};

export default ChatInput;
