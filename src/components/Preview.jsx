import { useLanguage } from '../i18n/LanguageContext';
import { ActionButtons } from './ActionButtons';

export function Preview({ mjReady, svgHtml, error, onDownloadSvg, fontSize, onFontSizeChange, font, onFontChange }) {
  const { t } = useLanguage();
  let content;

  if (!mjReady) {
    content = (
      <div className="mj-loading">
        <i className="ti ti-loader" aria-hidden="true" />
        {t.loadingMathJax}
      </div>
    );
  } else if (error) {
    content = (
      <span className="preview-error">
        <i className="ti ti-alert-triangle" aria-hidden="true" />
        <br />
        {error}
      </span>
    );
  } else if (svgHtml) {
    content = <div dangerouslySetInnerHTML={{ __html: svgHtml }} />;
  } else {
    content = <span className="preview-placeholder">{t.writePlaceholder}</span>;
  }

  return (
    <div className="panel">
      <div className="panel-label-row">
        <div className="panel-label">{t.panelPreview}</div>
        <ActionButtons
          onDownloadSvg={onDownloadSvg}
          fontSize={fontSize}
          onFontSizeChange={onFontSizeChange}
          font={font}
          onFontChange={onFontChange}
        />
      </div>
      <div id="preview-box">{content}</div>
    </div>
  );
}
