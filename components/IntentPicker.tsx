import React from 'react';
import { ContactIntent } from '../types';
import { CONTACT_INTENT_KEYS, getIntentLabel } from '../constants/intents';
import { useLanguage } from '../contexts/LanguageContext';

interface IntentPickerProps {
  selected: ContactIntent | null;
  onSelect: (intent: ContactIntent) => void;
  disabled?: boolean;
}

const IntentPicker: React.FC<IntentPickerProps> = ({ selected, onSelect, disabled }) => {
  const { locale, t } = useLanguage();

  return (
    <div className="space-y-2" role="group" aria-label={t('intentPickerLabel')}>
      <p className="text-sm text-gray-300">{t('intentPickerPrompt')}</p>
      <div className="flex flex-wrap gap-2">
        {CONTACT_INTENT_KEYS.map((key) => {
          const isSelected = selected === key;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(key)}
              className={[
                'rounded-full px-3 py-1.5 text-sm transition-colors border',
                isSelected
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-100 hover:bg-gray-600',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
              aria-pressed={isSelected}
            >
              {getIntentLabel(key, locale)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default IntentPicker;
