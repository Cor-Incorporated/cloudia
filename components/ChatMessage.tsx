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
      <div className="mt-2 pt-2 border-t border-gray-600/60">
        <h4 className="text-xs font-semibold text-gray-400 mb-1">{t('sources')}:</h4>
        <ul className="list-disc list-inside space-y-1">
          {sources.map((source, index) => (
            <li key={index} className="text-xs">
              <a
                href={source.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 hover:text-blue-200 underline"
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
      className={`flex w-full mb-3 items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="shrink-0 self-end pb-0.5">
          <ExpressionAvatar emotion={emotion} size={40} compact />
        </div>
      )}
      <div
        className={[
          'max-w-[75%] sm:max-w-md lg:max-w-lg px-3.5 py-2.5 shadow-md text-sm leading-relaxed whitespace-pre-wrap break-words',
          isUser
            ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
            : 'bg-gray-700 text-gray-50 rounded-2xl rounded-bl-md',
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
