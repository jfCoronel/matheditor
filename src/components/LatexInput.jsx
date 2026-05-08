import { useRef, useMemo, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { autocompletion } from '@codemirror/autocomplete';
import { keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { solarizedLightInit, solarizedDarkInit } from '@uiw/codemirror-theme-solarized';
import { tags as t } from '@lezer/highlight';
import { EXAMPLES, ASCII_EXAMPLES } from '../data/examples';
import { latexCompletionSource } from '../data/latexCompletions';
import { asciimathCompletionSource } from '../data/asciimathCompletions';
import { asciimathLanguage } from '../data/asciimathMode';

const bracketStyle = { tag: t.bracket, color: '#CB4B16', fontWeight: '600' };

const themeDark  = solarizedDarkInit ({ styles: [bracketStyle] });
const themeLight = solarizedLightInit({ styles: [bracketStyle] });

export function LatexInput({ value, onChange, onRender, inputMode, onModeChange, dark }) {
  const debounceRef = useRef(null);
  const onRenderRef = useRef(onRender);
  useEffect(() => { onRenderRef.current = onRender; }, [onRender]);

  const latexExtensions = useMemo(() => [
    StreamLanguage.define(stex),
    autocompletion({ override: [latexCompletionSource] }),
    Prec.highest(keymap.of([{
      key: 'Ctrl-Enter', mac: 'Cmd-Enter',
      run() { clearTimeout(debounceRef.current); onRenderRef.current(editorValueRef.current); return true; },
    }])),
  ], []);

  const asciimathExtensions = useMemo(() => [
    asciimathLanguage,
    autocompletion({ override: [asciimathCompletionSource] }),
    Prec.highest(keymap.of([{
      key: 'Ctrl-Enter', mac: 'Cmd-Enter',
      run() { clearTimeout(debounceRef.current); onRenderRef.current(editorValueRef.current); return true; },
    }])),
  ], []);

  const editorValueRef = useRef(value);
  useEffect(() => { editorValueRef.current = value; }, [value]);

  function handleChange(val) {
    editorValueRef.current = val;
    onChange(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onRenderRef.current(val), 450);
  }

  const examples = inputMode === 'asciimath' ? ASCII_EXAMPLES : EXAMPLES;
  const placeholder = inputMode === 'asciimath'
    ? 'int_0^oo e^(-x^2) dx = sqrt(pi)/2'
    : '\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}';

  function handleExample(src) {
    onChange(src);
    clearTimeout(debounceRef.current);
    onRenderRef.current(src);
  }

  return (
    <div className="panel">
      <div className="panel-label-row">
        <span className="panel-label" style={{ margin: 0 }}>Fuente</span>
        <div className="mode-toggle">
          <button
            className={`mode-btn${inputMode === 'tex' ? ' active' : ''}`}
            onClick={() => onModeChange('tex')}
          >LaTeX</button>
          <button
            className={`mode-btn${inputMode === 'asciimath' ? ' active' : ''}`}
            onClick={() => onModeChange('asciimath')}
          >ASCIIMath</button>
        </div>
        <select
          className="ex-select"
          value=""
          onChange={e => { if (e.target.value) handleExample(e.target.value); }}
        >
          <option value="" disabled>Ejemplos de ecuaciones…</option>
          {examples.map(ex => (
            <option key={ex.label} value={ex.src}>{ex.label}</option>
          ))}
        </select>
      </div>
      <CodeMirror
        value={value}
        onChange={handleChange}
        theme={dark ? themeDark : themeLight}
        extensions={inputMode === 'asciimath' ? asciimathExtensions : latexExtensions}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: false,
          highlightActiveLine: false,
          highlightSelectionMatches: false,
        }}
        className="cm-latex-editor"
        placeholder={placeholder}
      />
    </div>
  );
}
