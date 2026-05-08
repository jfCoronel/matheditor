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

export default function App() {
  const [latexInput,       setLatexInput]      = useState('');
  const [currentSvgString, setCurrentSvgString] = useState('');
  const [currentLatex,     setCurrentLatex]    = useState('');
  const [previewSvgHtml,   setPreviewSvgHtml]  = useState('');
  const [previewError,     setPreviewError]    = useState('');
  const [status,           setStatusState]     = useState({ message: '', type: '' });
  const [svgPicker,        setSvgPicker]       = useState([]);
  const [fontSize,         setFontSize]        = useState(12);

  const mjReady     = useMathJax();
  const initialised = useRef(false);
  const fontSizeRef = useRef(12);
  const latexInputRef = useRef('');

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
      setStatus('MathJax aún no está listo...', '');
      return;
    }

    try {
      const container = window.MathJax.tex2svg(trimmed, { display: true });

      if (container.querySelector('[data-mml-node="merror"]')) {
        throw new Error('Sintaxis LaTeX inválida — revisa la expresión');
      }

      const svgEl = container.querySelector('svg');
      if (!svgEl) throw new Error('MathJax no generó ningún SVG');

      setCurrentLatex(trimmed);
      setCurrentSvgString(buildExportSvg(svgEl, trimmed, pt));

      const preview = svgEl.cloneNode(true);
      applyPtDimensions(preview, pt);
      preview.style.cssText = 'max-width:100%; max-height:220px; height:auto;';
      setPreviewSvgHtml(preview.outerHTML);
      setPreviewError('');

      setStatus(`✓ Renderizado · ${trimmed.length} chars · SVG listo para exportar`, 'ok');
    } catch (e) {
      setPreviewSvgHtml('');
      setPreviewError(e.message);
      setCurrentSvgString('');
      setStatus(e.message, 'err');
    }
  }, [setStatus]);

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

  const handleDownload = useCallback(() => {
    if (!currentSvgString) { setStatus('Nada que descargar', 'err'); return; }

    const safeName = currentLatex
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 30)
      .replace(/_+$/g, '') || 'ecuacion';

    const blob = new Blob([currentSvgString], { type: 'image/svg+xml' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `eq_${safeName}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus('✓ Descargado: eq_' + safeName + '.svg', 'ok');
  }, [currentSvgString, currentLatex, setStatus]);

  const loadSvgContent = useCallback((content, name = 'archivo.svg') => {
    const latex = parseSvgForLatex(content);
    if (latex) {
      latexInputRef.current = latex;
      setLatexInput(latex);
      renderLatex(latex);
      setStatus('✓ LaTeX recuperado: ' + latex.substring(0, 60) + (latex.length > 60 ? '…' : ''), 'ok');
    } else {
      setStatus(`"${name}" no contiene metadatos LaTeX (no fue generado con este editor).`, 'err');
    }
  }, [renderLatex, setStatus]);

  const handleLoadFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
      setStatus('Selecciona un archivo .svg', 'err');
      return;
    }
    const reader = new FileReader();
    reader.onload  = e => { try { loadSvgContent(e.target.result, file.name); } catch (err) { setStatus('Error al analizar el SVG: ' + err.message, 'err'); } };
    reader.onerror = () => setStatus('Error al leer el archivo.', 'err');
    reader.readAsText(file);
  }, [loadSvgContent, setStatus]);

  const handleLoadDoc = useCallback(async (file) => {
    setStatus('Extrayendo SVGs del documento…', '');
    setSvgPicker([]);
    try {
      const svgs = await extractSvgsFromDoc(file);
      if (svgs.length === 0) {
        setStatus('No se encontraron SVGs en el documento.', 'err');
        return;
      }
      if (svgs.length === 1) {
        loadSvgContent(svgs[0].content, svgs[0].name);
        return;
      }
      setSvgPicker(svgs);
      setStatus(`Se encontraron ${svgs.length} SVGs en el documento — selecciona uno:`, '');
    } catch (e) {
      setStatus('Error al procesar el documento: ' + e.message, 'err');
    }
  }, [loadSvgContent, setStatus]);

  const handleLoadAny = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (DOC_EXTENSIONS.includes(ext)) handleLoadDoc(file);
    else handleLoadFile(file);
  }, [handleLoadDoc, handleLoadFile]);

  return (
    <>
      <Header />
      <main>
        <div className="panels">
          <LatexInput
            value={latexInput}
            onChange={v => { latexInputRef.current = v; setLatexInput(v); }}
            onRender={renderLatex}
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
