// Choosing the document to convert and writing the result next to it.
//
// An <a download> always lands in the browser's download folder, which is not
// where the document being converted lives. The File System Access API lets us
// open the save dialog already pointing at the source file's own folder —
// `startIn` takes a handle and resolves to the directory containing it — so the
// default answer is the right one and the user only has to confirm.
//
// Two quirks shape this module:
//   - Safari declares the pickers but never prompts for a name (same reason
//     App.jsx skips it there), so it takes the plain download path.
//   - A file picker needs transient user activation, and typesetting a hundred
//     equations outlives it. The save is not lost when that happens: the caller
//     gets back 'gesture' and re-offers the save behind a fresh click.

const isSafari = /^((?!chrome|android).)*safari/i.test(
  typeof navigator === 'undefined' ? '' : navigator.userAgent);

const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt:  'application/vnd.oasis.opendocument.text',
};

const OPEN_TYPES = [{
  description: 'Word (.docx) / Writer (.odt)',
  accept: { [MIME.docx]: ['.docx'], [MIME.odt]: ['.odt'] },
}];

export const HAS_FILE_PICKERS =
  typeof window !== 'undefined' && !!window.showSaveFilePicker && !!window.showOpenFilePicker && !isSafari;

/**
 * Opens the document picker.
 * -> { status: 'ok', file, handle } — the handle is what anchors the save dialog
 *    to the same folder, so it travels with the file all the way to saveDocument
 * -> { status: 'aborted' } | { status: 'unavailable' } (caller falls back to <input>)
 */
export async function pickDocument() {
  if (!HAS_FILE_PICKERS) return { status: 'unavailable' };
  try {
    const [handle] = await window.showOpenFilePicker({ multiple: false, types: OPEN_TYPES });
    return { status: 'ok', handle, file: await handle.getFile() };
  } catch (e) {
    if (e.name === 'AbortError') return { status: 'aborted' };
    return { status: 'unavailable' };
  }
}

// 'tesis.docx' + '_svg' -> 'tesis_svg.docx'. An already converted document is
// renamed, not stacked: reverting 'tesis_svg.docx' gives 'tesis_code.docx'.
export function outputName(sourceName, suffix) {
  const ext  = sourceName.split('.').pop();
  const base = sourceName.slice(0, -(ext.length + 1)).replace(/_(svg|code)$/i, '');
  return `${base}${suffix}.${ext}`;
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/**
 * Writes the converted document, offering the source file's own folder first.
 * -> { status: 'saved' | 'downloaded', name } | { status: 'aborted' }
 *  | { status: 'gesture' } — activation expired; ask the user to click and retry
 */
export async function saveDocument({ blob, name, sourceHandle }) {
  if (!HAS_FILE_PICKERS) {
    download(blob, name);
    return { status: 'downloaded', name };
  }

  const ext = name.split('.').pop().toLowerCase();
  let handle;
  try {
    handle = await window.showSaveFilePicker({
      suggestedName: name,
      ...(sourceHandle ? { startIn: sourceHandle } : {}),
      types: [{ description: ext.toUpperCase(), accept: { [MIME[ext] ?? 'application/octet-stream']: [`.${ext}`] } }],
    });
  } catch (e) {
    if (e.name === 'AbortError') return { status: 'aborted' };
    // No transient activation left: better to ask for one more click than to
    // silently drop the file in the download folder.
    if (e.name === 'SecurityError' || e.name === 'NotAllowedError') return { status: 'gesture' };
    download(blob, name);
    return { status: 'downloaded', name };
  }

  try {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch {
    download(blob, handle.name);
    return { status: 'downloaded', name: handle.name };
  }
  return { status: 'saved', name: handle.name };
}
