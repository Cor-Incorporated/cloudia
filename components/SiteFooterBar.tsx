import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { SITE_CHROME, commonLinksFor, siteChromeYear, type SiteChromeSiteId } from '../constants/siteChrome';

interface SiteFooterBarProps {
  /** 今のサイト。aria-current と強調に使う。 */
  currentSite?: SiteChromeSiteId;
  /** 試験で年を固定するため。既定は今の年。 */
  now?: Date;
}

/**
 * 3 サイト共通の下の帯。1024px 以上は 64px の 1 行、未満は縦 3 段。
 * 中身は constants/siteChrome.json にまとめてある。
 */
const SiteFooterBar: React.FC<SiteFooterBarProps> = ({ currentSite = 'cloudia', now }) => {
  const { locale, t } = useLanguage();
  const year = siteChromeYear(now);
  const copy = `© ${year} ${SITE_CHROME.organization[locale]}`;
  const links = commonLinksFor(locale);

  return (
    <footer
      data-testid="site-footer"
      className="shrink-0 border-t border-stone-200 bg-stone-100 text-[13px] text-stone-600 lg:h-16"
    >
      <div className="flex flex-col items-start gap-2.5 px-3 py-4 lg:h-full lg:flex-row lg:items-center lg:gap-6 lg:px-6 lg:py-0">
        <p className="whitespace-nowrap">{copy}</p>

        <nav
          data-testid="footer-common-links"
          aria-label={t('commonLinksLabel')}
          className="flex flex-wrap items-center gap-x-4 gap-y-2.5 lg:flex-1 lg:justify-center lg:gap-6"
        >
          {links.map((link) => (
            <a
              key={link.id}
              href={link.href}
              rel="noopener"
              className="inline-flex min-h-11 items-center py-2 text-stone-900 no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <nav
          data-testid="footer-sites"
          aria-label={t('sitesLabel')}
          className="flex items-center gap-3.5 lg:gap-4"
        >
          {SITE_CHROME.sites.map((site) => {
            const current = site.id === currentSite;
            return (
              <a
                key={site.id}
                href={site.href}
                rel="noopener"
                aria-current={current ? 'page' : undefined}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center px-2 py-2 no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
                  current ? 'font-bold text-stone-900' : 'text-stone-600'
                }`}
              >
                {site.label}
              </a>
            );
          })}
        </nav>
      </div>
    </footer>
  );
};

export default SiteFooterBar;
