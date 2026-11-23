import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { privacyPolicyHref } from '../constants/privacy';

interface PrivacyPolicyLinkProps {
  className?: string;
  label?: string;
}

/**
 * プライバシーポリシーへの 1 文のリンク。浮きボタンの枠（iframe）の中でも会話を残すため、新しいタブで開く。
 * 文は corsweb の問い合わせフォームの文（contactConsent の linkBefore・linkText・linkAfter）と同じ言い回し。
 */
const PrivacyPolicyLink: React.FC<PrivacyPolicyLinkProps> = ({ className, label }) => {
  const { locale, t } = useLanguage();
  const search = typeof window === 'undefined' ? '' : window.location.search;

  return (
    <span className={className}>
      {!label && t('privacyLinkBefore')}
      <a
        href={privacyPolicyHref(locale, search)}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      >
        {label ?? t('privacyLinkText')}
        <span className="sr-only">{t('privacyLinkNewTab')}</span>
      </a>
      {!label && t('privacyLinkAfter')}
    </span>
  );
};

export default PrivacyPolicyLink;
