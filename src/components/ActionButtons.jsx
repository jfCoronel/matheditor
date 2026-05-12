import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

function FontSizeInput({ fontSize, onFontSizeChange }) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(String(fontSize));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(String(fontSize));
    setInvalid(false);
  }, [fontSize]);

  function commit(raw) {
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 6 || n > 72) {
      setInvalid(true);
      setDraft(String(fontSize));
      setTimeout(() => setInvalid(false), 1200);
    } else {
      setInvalid(false);
      onFontSizeChange(n);
    }
  }

  return (
    <label className="font-size-control">
      <span>{t.fontSize}</span>
      <input
        type="text"
        inputMode="numeric"
        className={`font-size-input${invalid ? ' font-size-invalid' : ''}`}
        value={draft}
        onChange={e => { setDraft(e.target.value); setInvalid(false); }}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } }}
      />
      <span>pt</span>
    </label>
  );
}

export function ActionButtons({ onDownloadSvg, fontSize, onFontSizeChange }) {
  const { t } = useLanguage();
  return (
    <div className="actions">
      <button className="act-btn primary" onClick={onDownloadSvg}>
        <i className="ti ti-download" aria-hidden="true" />
        {t.downloadSvg}
      </button>
      <FontSizeInput fontSize={fontSize} onFontSizeChange={onFontSizeChange} />
    </div>
  );
}
