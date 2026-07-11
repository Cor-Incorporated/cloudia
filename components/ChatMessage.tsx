import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Emotion, Source } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const { t } = useLanguage();
  const isUser = message.sender === 'user';
  const bgColor = isUser ? 'bg-blue-600' : 'bg-gray-700';
  const textAlign = isUser ? 'text-right' : 'text-left';
  const bubbleAlign = isUser ? 'ml-auto' : 'mr-auto';
  
  const emotionToEmoji = (emotion?: Emotion): string => {
    if (!emotion) return '';
    switch(emotion) {
        case Emotion.HAPPY: return '😊';
        case Emotion.ANGRY: return '😠';
        case Emotion.SAD: return '😢';
        case Emotion.ENJOYING: return '😄';
        case Emotion.SURPRISED: return '😮';
        case Emotion.SHY: return '😳';
        case Emotion.THINKING: return '🤔';
        case Emotion.PROUD: return '😎';
        default: return '';
    }
  }

  const renderSources = (sources?: Source[]) => {
    if (!sources || sources.length === 0) return null;
    return (
      <div className="mt-2 pt-2 border-t border-gray-600">
        <h4 className="text-xs font-semibold text-gray-400 mb-1">{t('sources')}:</h4>
        <ul className="list-disc list-inside space-y-1">
          {sources.map((source, index) => (
            <li key={index} className="text-xs">
              <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                {source.title || source.uri}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // 表情はヘッダー／サイドの ExpressionAvatar が主。バブル側 emoji は控えめに。
  const showEmoji =
    message.emotion &&
    message.emotion !== Emotion.ENJOYING &&
    message.emotion !== Emotion.THINKING;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl px-4 py-3 rounded-xl shadow ${bgColor} ${bubbleAlign}`}>
        <div className={`${textAlign} text-white prose prose-sm prose-invert max-w-none`}>
           <ReactMarkdown
            components={{
                a: ({node, ...props}) => <a className="text-blue-300 hover:underline" {...props} />,
              }}
           >{message.text + (showEmoji ? ` ${emotionToEmoji(message.emotion)}` : '')}</ReactMarkdown>
        </div>
        {renderSources(message.sources)}
      </div>
    </div>
  );
};

export default ChatMessage;
