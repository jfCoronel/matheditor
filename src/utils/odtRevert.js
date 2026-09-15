// The way back for Writer documents: every equation frame becomes the $$…$$ /
// $$$…$$$ source it was generated from. Same contract and same reasoning as
// docxRevert — the embedded SVG is the only record of what the equation says.

import JSZip from 'jszip';
import { wrapFormula } from './docxMath';
import { parseSvgForLatex } from './svgLoader';
import { ODF, textNodes } from './odtInject';
import { parseXml, serialize, findAll } from './xmlUtils';

const CONTENT  = 'content.xml';
const STYLES   = 'styles.xml';
const MANIFEST = 'META-INF/manifest.xml';

// 'Pictures/eq-1.svg', './Pictures/eq-1.svg' and '/Pictures/eq-1.svg' all name
// the same package entry.
const partPath = href => String(href).replace(/^\.?\//, '');

const isAttached = node => {
  for (let n = node; n; n = n.parentNode) if (n.nodeType === 9) return true;
  return false;
};

// An image is either a reference into Pictures/ or, after some round trips
// through LibreOffice, base64 sitting inline in the document.
async function imageSvg(zip, image) {
  const href = image.getAttributeNS(ODF.xlink, 'href');
  if (href) {
    const entry = zip.file(partPath(href));
    return entry ? { svg: await entry.async('string'), path: partPath(href) } : null;
  }
  const data = findAll(image, ODF.office, 'binary-data')[0];
  if (!data) return null;
  try {
    const bytes = Uint8Array.from(atob(data.textContent.replace(/\s+/g, '')), c => c.charCodeAt(0));
    return { svg: new TextDecoder().decode(bytes), path: null };
  } catch { return null; }
}

// Every Pictures/ entry still referenced once the frames are gone. Page styles
// live in styles.xml and can hold images of their own, so both parts are read.
function liveHrefs(docs) {
  const used = new Set();
  for (const doc of docs) {
    if (!doc) continue;
    for (const el of Array.from(doc.getElementsByTagName('*'))) {
      const href = el.getAttributeNS?.(ODF.xlink, 'href');
      if (href) used.add(partPath(href));
    }
  }
  return used;
}

/**
 * Turns every equation frame of an .odt back into its source expression.
 * -> { blob, results, restored, skipped }; blob is null when there is nothing to undo.
 */
export async function revertOdt(file, { onProgress, outputType = 'blob' } = {}) {
  const zip     = await JSZip.loadAsync(file);
  const content = zip.file(CONTENT);
  if (!content) throw new Error('El archivo no parece un .odt (falta content.xml)');

  const doc = parseXml(await content.async('string'));

  const candidates = [];
  for (const frame of findAll(doc.documentElement, ODF.draw, 'frame')) {
    const image = findAll(frame, ODF.draw, 'image')[0];
    if (image) candidates.push({ frame, image });
  }
  if (!candidates.length) return { blob: null, results: [], restored: 0, skipped: 0 };

  const results = [];
  const dropped = [];
  let done = 0;

  for (const c of candidates) {
    onProgress?.({ done, total: candidates.length });
    done++;
    // A frame nested inside one already replaced is no longer in the document.
    if (!isAttached(c.frame)) continue;

    const found = await imageSvg(zip, c.image);
    if (!found) { results.push({ ok: false, reason: 'missing' }); continue; }

    let meta = null;
    try { meta = parseSvgForLatex(found.svg); } catch { /* no es de las nuestras */ }
    if (!meta?.formula) { results.push({ ok: false, reason: 'no-metadata' }); continue; }

    const parent = c.frame.parentNode;
    for (const n of textNodes(wrapFormula(meta.formula, meta.mode), doc)) parent.insertBefore(n, c.frame);
    parent.removeChild(c.frame);

    if (found.path) dropped.push(found.path);
    results.push({ ok: true, name: meta.name ?? null, mode: meta.mode, source: meta.formula });
  }
  onProgress?.({ done, total: candidates.length });

  const restored = results.filter(r => r.ok).length;
  if (!restored) return { blob: null, results, restored: 0, skipped: results.length };

  // Drop the pictures nothing points at any more, manifest entry included.
  const stylesEntry = zip.file(STYLES);
  const stylesDoc   = stylesEntry ? parseXml(await stylesEntry.async('string')) : null;
  const live        = liveHrefs([doc, stylesDoc]);
  const gone        = new Set(dropped.filter(p => !live.has(p)));

  for (const path of gone) zip.remove(path);

  const manifest = zip.file(MANIFEST);
  if (manifest && gone.size) {
    const mDoc = parseXml(await manifest.async('string'));
    for (const e of findAll(mDoc.documentElement, ODF.manifest, 'file-entry')) {
      if (gone.has(e.getAttributeNS(ODF.manifest, 'full-path'))) e.parentNode.removeChild(e);
    }
    zip.file(MANIFEST, serialize(mDoc));
  }

  zip.file(CONTENT, serialize(doc));

  // The mimetype entry must stay uncompressed for the package to be recognised.
  const mimetype = zip.file('mimetype');
  if (mimetype) zip.file('mimetype', await mimetype.async('string'), { compression: 'STORE' });

  const blob = await zip.generateAsync({
    type: outputType,
    mimeType: 'application/vnd.oasis.opendocument.text',
    compression: 'DEFLATE',
  });

  return { blob, results, restored, skipped: results.length - restored };
}
