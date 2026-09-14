import { useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { convertDocx } from '../utils/docxInject';
import { convertOdt } from '../utils/odtInject';
import { createMathRenderer } from '../utils/mathRender';

const CONVERTERS = { docx: convertDocx, odt: convertOdt };

export function ConvertDoc({ mjReady, font, onStatus }) {
  const { t } = useLanguage();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';                       // allow picking the same file again
    if (!file) return;

    const ext     = file.name.split('.').pop().toLowerCase();
    const convert = CONVERTERS[ext];
    if (!convert) {
      onStatus(t.unsupportedDoc(ext), 'err');
      return;
    }

    setBusy(true);
    onStatus(t.convertingDoc(file.name), '');

    try {
      const result = await convert(file, {
        render: createMathRenderer({ font }),
        onProgress: ({ done, total }) => onStatus(t.convertingProgress(done, total), ''),
      });

      if (!result.blob) {
        onStatus(t.noEquationsInDoc, 'err');
        return;
      }

      const name = file.name.replace(/\.[^.]+$/, '') + t.convertedSuffix + '.' + ext;
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(result.blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);

      onStatus(t.conversionDone(result.converted, result.failed), result.failed ? 'err' : 'ok');
    } catch (err) {
      onStatus(t.errorProcessingDoc(err.message), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="doc-convert">
      <button
        className="act-btn primary"
        onClick={() => inputRef.current?.click()}
        disabled={!mjReady || busy}
      >
        <i className={`ti ${busy ? 'ti-loader-2' : 'ti-file-type-docx'}`} aria-hidden="true" />
        {busy ? t.convertingShort : t.convertDocButton}
      </button>
      <span className="doc-convert-hint">{t.convertDocHint}</span>
      <input
        ref={inputRef}
        type="file"
        accept=".docx,.odt"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </div>
  );
}
