import { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { translations, Locale } from '../translations';
import { resolveUiLocale } from '../utils/contactLocale';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof typeof translations.en, replacements?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  // Attempt to get language from localStorage or default to browser language or 'en'
  const getInitialLocale = (): Locale => {
    return resolveUiLocale({
      query: new URLSearchParams(window.location.search).get('locale'),
      stored: localStorage.getItem('app-locale'),
      browserLanguage: navigator.language,
    });
  };

  const [locale, setLocaleState] = useState<Locale>(getInitialLocale());

  useEffect(() => {
    localStorage.setItem('app-locale', locale);
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
  };

  const t = useCallback((key: keyof typeof translations.en, replacements?: Record<string, string>): string => {
    let translatedString = translations[locale]?.[key] || translations.en[key];
    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        translatedString = translatedString.replace(`{{${placeholder}}}`, replacements[placeholder]);
      });
    }
    if (!translatedString && key) {
        // Fallback to key name if translation is missing, to help identify missing strings
        console.warn(`Translation missing for key: "${key}" in locale: "${locale}".`);
        return key;
    }
    return translatedString;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
