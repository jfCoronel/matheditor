import { useLanguage } from '../i18n/LanguageContext';

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer>
      MathEditor v {__APP_VERSION__} {t.developedBy} <a href="http://jfc.us.es" target="_blank" rel="noopener">jfCoronel</a>
      · {t.renderedWith}{' '}<a href="https://www.mathjax.org/" target="_blank" rel="noopener">MathJax 4.1</a>
      · {t.editedWith}{' '}<a href="https://codemirror.net" target="_blank" rel="noopener">CodeMirror</a>
    </footer>
  );
}
