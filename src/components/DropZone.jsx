import { useState, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

export function DropZone({ onFile }) {
  const { t } = useLanguage();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    onFile(e.dataTransfer.files[0]);
  }

  function handleClick() {
    fileInputRef.current?.click();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      fileInputRef.current?.click();
    }
  }

  function handleFileChange(e) {
    onFile(e.target.files[0]);
    e.target.value = '';
  }

  return (
    <>
      <div
        className={`drop-zone${isDragOver ? ' drag-over' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={t.dropZoneLabel}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <i className="ti ti-file-upload" aria-hidden="true" />
        {t.dropZonePre} <strong>.svg</strong> {t.dropZoneMid} <strong>.odt · .odp · .docx · .pptx</strong> {t.dropZonePost}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".svg,image/svg+xml,.odt,.odp,.ods,.docx,.pptx,.xlsx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </>
  );
}
