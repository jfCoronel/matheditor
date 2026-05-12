import { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LatexInput } from './components/LatexInput';
import { Preview } from './components/Preview';
import { ActionButtons } from './components/ActionButtons';
import { DropZone } from './components/DropZone';
import { SvgPicker } from './components/SvgPicker';
import { EXAMPLES } from './data/examples';
import { buildExportSvg, applyPtDimensions } from './utils/svgUtils';
import { parseSvgForLatex } from './utils/svgLoader';
import { extractSvgsFromDoc, DOC_EXTENSIONS } from './utils/docUtils';
import { useMathJax } from './hooks/useMathJax';
import { useLanguage } from './i18n/LanguageContext';

export default function App() {
  const { t } = useLanguage();
  const [latexInput,       setLatexInput]      = useState('');
  const [currentSvgString, setCurrentSvgString] = useState('');
  const [currentLatex,     setCurrentLatex]    = useState('');
  const [previewSvgHtml,   setPreviewSvgHtml]  = useState('');
  const [previewError,     setPreviewError]    = useState('');
  const [status,           setStatusState]     = useState({ message: '', type: '' });
  const [svgPicker,        setSvgPicker]       = useState([]);
  const [fontSize,         setFontSize]        = useState(12);
  const [inputMode,        setInputMode]       = useState('tex');

  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const toggleDark = useCallback(() => setDark(d => !d), []);

  const mjReady      = useMathJax();
  const initialised  = useRef(false);
  const fontSizeRef  = useRef(12);
  const latexInputRef = useRef('');
  const inputModeRef = useRef('tex');

  const setStatus = useCallback((message, type = '') => {
    setStatusState({ message, type });
  }, []);

  const renderLatex = useCallback((latex, pt = fontSizeRef.current) => {
    const trimmed = latex.trim();

    if (!trimmed) {
      setPreviewSvgHtml('');
      setPreviewError('');
      setCurrentSvgString('');
      setCurrentLatex('');
      setStatus('');
      return;
    }

    if (!window.MathJax?.tex2svg) {
      setStatus(t.mathJaxNotReady, '');
      return;
    }

    try {
      const renderFn = inputModeRef.current === 'asciimath'
        ? window.MathJax.asciimath2svg
        : window.MathJax.tex2svg;
      if (!renderFn) { setStatus(t.mathJaxNotReady, ''); return; }
      const container = renderFn.call(window.MathJax, trimmed, { display: true });

      if (container.querySelector('[data-mml-node="merror"]')) {
        throw new Error(
          inputModeRef.current === 'asciimath'
            ? t.invalidAsciimath
            : t.invalidLatex
        );
      }

      const svgEl = container.querySelector('svg');
      if (!svgEl) throw new Error(t.noSvgGenerated);

      setCurrentLatex(trimmed);
      setCurrentSvgString(buildExportSvg(svgEl, trimmed, pt, inputModeRef.current));

      const preview = svgEl.cloneNode(true);
      applyPtDimensions(preview, pt);
      preview.style.cssText = 'max-width:100%; height:auto;';
      setPreviewSvgHtml(preview.outerHTML);
      setPreviewError('');

      setStatus(t.rendered(trimmed.length), 'ok');
    } catch (e) {
      setPreviewSvgHtml('');
      setPreviewError(e.message);
      setCurrentSvgString('');
      setStatus(e.message, 'err');
    }
  }, [setStatus, t]);

  useEffect(() => {
    if (mjReady && !initialised.current) {
      initialised.current = true;
      const src = EXAMPLES[0].src;
      latexInputRef.current = src;
      setLatexInput(src);
      renderLatex(src);
    }
  }, [mjReady, renderLatex]);

  const handleFontSizeChange = useCallback((pt) => {
    fontSizeRef.current = pt;
    setFontSize(pt);
    if (latexInputRef.current.trim()) renderLatex(latexInputRef.current, pt);
  }, [renderLatex]);

  const handleModeChange = useCallback((mode) => {
    inputModeRef.current = mode;
    setInputMode(mode);
    latexInputRef.current = '';
    setLatexInput('');
    setPreviewSvgHtml('');
    setPreviewError('');
    setCurrentSvgString('');
    setCurrentLatex('');
    setStatus('');
  }, []);

  const handleDownload = useCallback(() => {
    if (!currentSvgString) { setStatus(t.nothingToDownload, 'err'); return; }

    const safeName = currentLatex
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 30)
      .replace(/_+$/g, '') || t.defaultEquationName;

    const blob = new Blob([currentSvgString], { type: 'image/svg+xml' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `eq_${safeName}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(t.downloaded(safeName), 'ok');
  }, [currentSvgString, currentLatex, setStatus, t]);

  const loadSvgContent = useCallback((content, name = 'archivo.svg') => {
    const result = parseSvgForLatex(content);
    if (result) {
      const { formula, mode } = result;
      inputModeRef.current = mode;
      setInputMode(mode);
      latexInputRef.current = formula;
      setLatexInput(formula);
      renderLatex(formula);
      setStatus(t.formulaRecovered(formula.substring(0, 60) + (formula.length > 60 ? '…' : '')), 'ok');
    } else {
      setStatus(t.noFormulaMetadata(name), 'err');
    }
  }, [renderLatex, setStatus, t]);

  const handleLoadFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
      setStatus(t.selectSvgFile, 'err');
      return;
    }
    const reader = new FileReader();
    reader.onload  = e => { try { loadSvgContent(e.target.result, file.name); } catch (err) { setStatus(t.errorParsingSvg(err.message), 'err'); } };
    reader.onerror = () => setStatus(t.errorReadingFile, 'err');
    reader.readAsText(file);
  }, [loadSvgContent, setStatus, t]);

  const handleLoadDoc = useCallback(async (file) => {
    setStatus(t.extractingSvgs, '');
    setSvgPicker([]);
    try {
      const svgs = await extractSvgsFromDoc(file);
      if (svgs.length === 0) {
        setStatus(t.noSvgsFound, 'err');
        return;
      }
      if (svgs.length === 1) {
        loadSvgContent(svgs[0].content, svgs[0].name);
        return;
      }
      setSvgPicker(svgs);
      setStatus(t.svgsFound(svgs.length), '');
    } catch (e) {
      setStatus(t.errorProcessingDoc(e.message), 'err');
    }
  }, [loadSvgContent, setStatus, t]);

  const handleLoadAny = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (DOC_EXTENSIONS.includes(ext)) handleLoadDoc(file);
    else handleLoadFile(file);
  }, [handleLoadDoc, handleLoadFile]);

  return (
    <>
      <Header dark={dark} onToggleDark={toggleDark} />
      <main>
        <div className="panels">
          <LatexInput
            value={latexInput}
            onChange={v => { latexInputRef.current = v; setLatexInput(v); }}
            onRender={renderLatex}
            inputMode={inputMode}
            onModeChange={handleModeChange}
            dark={dark}
          />
          <Preview
            mjReady={mjReady}
            svgHtml={previewSvgHtml}
            error={previewError}
          />
        </div>

        <ActionButtons
          onDownloadSvg={handleDownload}
          fontSize={fontSize}
          onFontSizeChange={handleFontSizeChange}
        />

        <div
          id="status"
          className={status.type}
          role="status"
          aria-live="polite"
        >
          {status.message}
        </div>

        {svgPicker.length > 0 && (
          <SvgPicker
            items={svgPicker}
            onSelect={(svg) => { loadSvgContent(svg.content, svg.name); setSvgPicker([]); }}
            onClose={() => setSvgPicker([])}
          />
        )}

        <DropZone onFile={handleLoadAny} />
      </main>
      <Footer />
    </>
  );
}
