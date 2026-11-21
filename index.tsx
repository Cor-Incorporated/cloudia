import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import { startAnalytics } from './services/analytics';
import { industryEntryLocale } from './utils/contactLocale';

// Read the industry page's language before analytics removes unsupported locales.
const initialLocale = industryEntryLocale(window.location.search);
// Once per page view, outside React, so StrictMode's double invocation cannot repeat it.
startAnalytics();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <LanguageProvider initialLocale={initialLocale}>
      <App />
    </LanguageProvider>
  </React.StrictMode>
);
