import { useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { convertDocx } from '../utils/docxInject';
import { convertOdt } from '../utils/odtInject';
import { revertDocx } from '../utils/docxRevert';
import { revertOdt } from '../utils/odtRevert';
import { createMathRenderer } from '../utils/mathRender';
import { pickDocument, saveDocument, outputName } from '../utils/docFile';

// '_svg' for the documents where the expressions have become images, '_code' for
// the way back. The suffix is part of the contract with the user, not a label:
// it stays in English in both languages so the two files are always recognisable.
const DIRECTIONS = {
  svg:  { suffix: '_svg',  needsMathJax: true,  run: { docx: convertDocx, odt: convertOdt } },
  code: { suffix: '_code', needsMathJax: false, run: { docx: revertDocx,  odt: revertOdt  } },
};

export function ConvertDoc({ mjReady, font, onStatus }) {
  const { t } = useLanguage();
  const inputRef   = useRef(null);
  const pendingDir = useRef('svg');            // direction the fallback <input> is serving
  const [busy, setBusy]       = useState(false);
  const [pending, setPending] = useState(null); // a converted document still to be written

  // The save dialog opens in the source document's own folder, so the obvious
  // answer puts the result next to the original. When the conversion has outlived
  // the click that started it the browser refuses to open any picker: rather than
  // dropping the file somewhere else, we park it here behind an explicit button.
  async function deliver(job) {
    const res = await saveDocument({ blob: job.blob, name: job.name, sourceHandle: job.handle });
    if (res.status === 'gesture') { setPending(job); onStatus(t.saveNeedsClick(job.name), ''); return; }
    if (res.status === 'aborted') { setPending(job); onStatus(t.saveCancelled, '');            return; }
    setPending(null);
    onStatus(`${job.summary} · ${t.savedAs(res.name)}`, job.failed ? 'err' : 'ok');
  }

  async function process(file, handle, dir) {
    const ext = file.name.split('.').pop().toLowerCase();
    const run = DIRECTIONS[dir].run[ext];
    if (!run) { onStatus(t.unsupportedDoc(ext), 'err'); return; }

    setBusy(true);
    setPending(null);
    onStatus(t.convertingDoc(file.name), '');

    try {
      const result = await run(file, {
        render: createMathRenderer({ font }),
        onProgress: ({ done, total }) => onStatus(
          dir === 'svg' ? t.convertingProgress(done, total) : t.revertingProgress(done, total), ''),
      });

      if (!result.blob) {
        onStatus(dir === 'svg' ? t.noEquationsInDoc : t.noSvgEquationsInDoc, 'err');
        return;
      }

      await deliver({
        blob:    result.blob,
        name:    outputName(file.name, DIRECTIONS[dir].suffix),
        handle,
        summary: dir === 'svg'
          ? t.conversionDone(result.converted, result.failed)
          : t.revertDone(result.restored, result.skipped),
        failed:  dir === 'svg' ? result.failed : 0,
      });
    } catch (err) {
      onStatus(t.errorProcessingDoc(err.message), 'err');
    } finally {
      setBusy(false);
    }
  }

  async function start(dir) {
    const picked = await pickDocument();
    if (picked.status === 'aborted') return;
    if (picked.status === 'unavailable') {   // no File System Access API: plain <input>
      pendingDir.current = dir;
      inputRef.current?.click();
      return;
    }
    await process(picked.file, picked.handle, dir);
  }

  async function handleChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';                       // allow picking the same file again
    if (file) await process(file, null, pendingDir.current);
  }

  const disabled = dir => busy || (DIRECTIONS[dir].needsMathJax && !mjReady);

  return (
    <section className="doc-convert-section">
      <div className="panel-label">{t.convertSectionTitle}</div>
      <div className="doc-convert">
        <button className="act-btn primary" onClick={() => start('svg')} disabled={disabled('svg')}>
          <i className={`ti ${busy ? 'ti-loader-2' : 'ti-file-type-docx'}`} aria-hidden="true" />
          {busy ? t.convertingShort : t.convertToSvgButton}
        </button>
        <button className="act-btn" onClick={() => start('code')} disabled={disabled('code')}>
          <i className="ti ti-file-code" aria-hidden="true" />
          {t.convertToCodeButton}
        </button>
        {pending && (
          <button className="act-btn" onClick={() => deliver(pending)} disabled={busy}>
            <i className="ti ti-device-floppy" aria-hidden="true" />
            {t.saveDocButton}
          </button>
        )}
        <span className="doc-convert-hint">{t.convertDocHint}</span>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,.odt"
          style={{ display: 'none' }}
          onChange={handleChange}
        />
      </div>
    </section>
  );
}
