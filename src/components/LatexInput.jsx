import { useRef, useMemo, useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { autocompletion } from '@codemirror/autocomplete';
import { keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { githubLight, githubDark } from '@uiw/codemirror-theme-github';
import { EXAMPLES } from '../data/examples';
import { latexCompletionSource } from '../data/latexCompletions';

function useDarkMode() {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = e => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return dark;
}

export function LatexInput({ value, onChange, onRender }) {
  const debounceRef = useRef(null);
  const onRenderRef = useRef(onRender);
  useEffect(() => { onRenderRef.current = onRender; }, [onRender]);

  const dark = useDarkMode();

  const extensions = useMemo(() => [
    StreamLanguage.define(stex),
    autocompletion({ override: [latexCompletionSource] }),
    Prec.highest(keymap.of([{
      key: 'Ctrl-Enter',
      mac: 'Cmd-Enter',
      run() {
        clearTimeout(debounceRef.current);
        onRenderRef.current(editorValueRef.current);
        return true;
      },
    }])),
  ], []);

  const editorValueRef = useRef(value);

  function handleChange(val) {
    editorValueRef.current = val;
    onChange(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onRenderRef.current(val), 450);
  }

  function handleExample(src) {
    onChange(src);
    clearTimeout(debounceRef.current);
    onRenderRef.current(src);
  }

  return (
    <div className="panel">
      <div className="panel-label">
        Fuente LaTeX{' '}
        <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10, marginLeft: 4 }}>
          (Ctrl+Enter para renderizar)
        </span>
      </div>
      <CodeMirror
        value={value}
        onChange={handleChange}
        theme={dark ? githubDark : githubLight}
        extensions={extensions}
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
        placeholder="\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}"
      />
      <select
        className="ex-select"
        value=""
        onChange={e => { if (e.target.value) handleExample(e.target.value); }}
      >
        <option value="" disabled>Ejemplos de ecuaciones…</option>
        {EXAMPLES.map(ex => (
          <option key={ex.label} value={ex.src}>{ex.label}</option>
        ))}
      </select>
    </div>
  );
}
