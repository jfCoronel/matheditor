import { useLanguage } from '../i18n/LanguageContext';

export function Header({ dark, onToggleDark }) {
  const { t, lang, toggleLang } = useLanguage();

  return (
    <header>
    <div className="header-inner">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="24" height="24" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#185fa5"/>
        <text x="16" y="24" fontSize="22" textAnchor="middle" fill="white" fontFamily="Georgia, serif">∑</text>
      </svg>
      <h1>{t.appTitle}</h1>
      <span className="badge">LaTeX · ASCIIMath · SVG</span>
      <button
        className="lang-toggle"
        onClick={toggleLang}
        title={t.switchLanguage}
        aria-label={t.switchLanguage}
      >
        {lang === 'es' ? 'EN' : 'ES'}
      </button>
      <button
        className="theme-toggle"
        onClick={onToggleDark}
        aria-label={dark ? t.toggleToLight : t.toggleToDark}
        title={dark ? t.modeLight : t.modeDark}
      >
        {dark ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
      </button>
    </div>
    </header>
  );
}
