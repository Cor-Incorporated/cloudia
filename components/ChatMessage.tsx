import React from 'react';
import { Message, Emotion, Source } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import ExpressionAvatar from './ExpressionAvatar';

interface ChatMessageProps {
  message: Message;
  /** intake では textContent 相当（XSS 防止）。ambassador もプレーンで統一可 */
  plainText?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, plainText = true }) => {
  const { t } = useLanguage();
  const isUser = message.sender === 'user';
  const emotion = message.emotion ?? Emotion.ENJOYING;

  const renderSources = (sources?: Source[]) => {
    if (!sources || sources.length === 0) return null;
    return (
      <div className="mt-2 border-t border-slate-200 pt-2">
        <h4 className="mb-1 text-xs font-semibold text-slate-500">{t('sources')}:</h4>
        <ul className="list-disc list-inside space-y-1">
          {sources.map((source, index) => (
            <li key={index} className="text-xs">
              <a
                href={source.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline hover:text-blue-900"
              >
                {source.title || source.uri}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // LINE 風: 左 AI（アバター + 吹き出し）、右 ユーザー
  return (
    <div
      className={`mb-3 flex w-full items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="shrink-0 self-end pb-0.5">
          <ExpressionAvatar emotion={emotion} size={40} compact />
        </div>
      )}
      <div
        className={[
          'max-w-[calc(100%-3rem)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ring-1 ring-black/5 whitespace-pre-wrap break-words sm:max-w-xl',
          isUser
            ? 'rounded-br-md bg-blue-600 text-white'
            : 'rounded-bl-md bg-white text-slate-800',
        ].join(' ')}
      >
        {plainText ? (
          <p className="m-0">{message.text}</p>
        ) : (
          <p className="m-0">{message.text}</p>
        )}
        {!isUser && renderSources(message.sources)}
      </div>
    </div>
  );
};

export default ChatMessage;
