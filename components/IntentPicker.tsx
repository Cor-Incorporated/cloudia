import React from 'react';
import { ContactIntent } from '../types';
import { CONTACT_INTENT_DISPLAY_OPTIONS } from '../constants/intents';
import { useLanguage } from '../contexts/LanguageContext';

interface IntentPickerProps {
  selected: ContactIntent | null;
  onSelect: (intent: ContactIntent) => void;
  disabled?: boolean;
  describedBy?: string;
}

export function resolveIntentSelection(
  option: (typeof CONTACT_INTENT_DISPLAY_OPTIONS)[number],
  selected: ContactIntent | null,
): ContactIntent {
  return selected && option.intents.some((intent) => intent === selected)
    ? selected
    : option.primaryIntent;
}

const IntentPicker: React.FC<IntentPickerProps> = ({ selected, onSelect, disabled, describedBy }) => {
  const { locale, t } = useLanguage();

  return (
    <fieldset className="space-y-2" aria-describedby={describedBy}>
      <legend className="text-sm font-medium text-gray-800">{t('intentPickerPrompt')}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label={t('intentPickerLabel')}>
        {CONTACT_INTENT_DISPLAY_OPTIONS.map((option) => {
          const isSelected = selected !== null && option.intents.some((intent) => intent === selected);
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(resolveIntentSelection(option, selected))}
              className={[
                'min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
                isSelected
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 bg-white text-gray-800 hover:border-blue-400 hover:bg-blue-50',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
              aria-pressed={isSelected}
            >
              {option.label[locale]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
};

export default IntentPicker;
