import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

function mjFonts(t) {
  return [
    { value: '',                 label: `New CM (${t.fontDefault})` },
    { value: 'mathjax-tex',     label: `TeX (${t.fontClassic})` },
    { value: 'mathjax-stix2',   label: 'STIX2' },
    { value: 'mathjax-termes',  label: 'Termes (Times)' },
    { value: 'mathjax-pagella', label: 'Pagella (Palatino)' },
    { value: 'mathjax-asana',   label: 'Asana' },
    { value: 'mathjax-bonum',   label: 'Bonum (Bookman)' },
    { value: 'mathjax-schola',  label: 'Schola' },
    { value: 'mathjax-dejavu',  label: 'DejaVu' },
    { value: 'mathjax-fira',    label: 'Fira (Sans)' },
    { value: 'mathjax-modern',  label: 'Latin Modern' },
  ];
}

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

function FontSelector({ font, onFontChange }) {
  const { t } = useLanguage();
  const fonts = mjFonts(t);
  return (
    <label className="font-size-control">
      <span>{t.fontFace}</span>
      <select
        className="font-select"
        value={font}
        onChange={e => onFontChange(e.target.value)}
      >
        {fonts.map(f => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
    </label>
  );
}

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
const downloadShortcut = isMac ? '⌘S' : 'Ctrl+S';

export function ActionButtons({ onDownloadSvg, fontSize, onFontSizeChange, font, onFontChange }) {
  const { t } = useLanguage();
  return (
    <div className="actions">
      <button className="act-btn primary" onClick={onDownloadSvg} data-shortcut={downloadShortcut}>
        <i className="ti ti-download" aria-hidden="true" />
        {t.downloadSvg}
      </button>
      <span className="actions-spacer" />
      <FontSelector font={font} onFontChange={onFontChange} />
      <FontSizeInput fontSize={fontSize} onFontSizeChange={onFontSizeChange} />
    </div>
  );
}
