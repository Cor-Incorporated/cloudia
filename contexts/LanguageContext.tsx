import { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { translations, Locale } from '../translations';
import { normalizeLocale, resolveLaunchContext, syncHtmlLang } from '../utils/launchContext';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof typeof translations.en, replacements?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  // Attempt to get language from localStorage or default to browser language or 'en'
  const getInitialLocale = (): Locale => {
    const browserLocale = normalizeLocale(navigator.language.split('-')[0], 'en');
    const storedLocale = normalizeLocale(localStorage.getItem('app-locale'), browserLocale);
    return resolveLaunchContext(window.location.search, storedLocale).locale;
  };

  const [locale, setLocaleState] = useState<Locale>(getInitialLocale());

  useEffect(() => {
    localStorage.setItem('app-locale', locale);
    syncHtmlLang(document.documentElement, locale);
    const url = new URL(window.location.href);
    url.searchParams.set('locale', locale);
    window.history.replaceState({}, '', url.toString());
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
