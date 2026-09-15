// The way back: every equation image in a .docx becomes the $$…$$ / $$$…$$$
// source it was generated from.
//
// The SVG itself is the only source of truth. convertDocx deletes the original
// text, so what an equation says lives exclusively in the metadata carried by the
// embedded SVG — `<metadata>` when the file has not been through Word, and the
// `lxs2-` root id when it has (Word strips the metadata block but keeps the id).
// An image whose SVG says nothing is left exactly where it is.

import JSZip from 'jszip';
import { wrapFormula } from './docxMath';
import { parseSvgForLatex } from './svgLoader';
import { NS } from './ooxml';
import { parseXml, serialize, findAll } from './xmlUtils';

const XML_NS   = 'http://www.w3.org/XML/1998/namespace';
const DOC_PART = 'word/document.xml';
const RELS     = 'word/_rels/document.xml.rels';

// ------------------------------------------------------------------ navigation

function relationships(relsDoc) {
  const map = new Map();
  for (const r of findAll(relsDoc.documentElement, NS.rel, 'Relationship')) {
    if (r.getAttribute('TargetMode') === 'External') continue;
    map.set(r.getAttribute('Id'), r.getAttribute('Target'));
  }
  return map;
}

// Relationship targets are relative to word/, but Word also writes them absolute
// ('/word/media/x.svg') when it feels like it.
const partPath = target =>
  'word/' + String(target).replace(/^\/?word\//, '').replace(/^\.?\//, '');

const ancestorRun = el => {
  for (let n = el.parentNode; n; n = n.parentNode) {
    if (n.nodeType === 1 && n.namespaceURI === NS.w && n.localName === 'r') return n;
  }
  return null;
};

// The equation is drawn from <asvg:svgBlip>; the <a:blip> around it points at the
// raster fallback. Both relationships die with the run.
function blipRefs(drawing) {
  const svgBlip = findAll(drawing, NS.asvg, 'svgBlip')[0];
  if (!svgBlip) return null;
  const svgRid = svgBlip.getAttributeNS(NS.r, 'embed');
  if (!svgRid) return null;

  const blip   = findAll(drawing, NS.a, 'blip')[0];
  const pngRid = blip?.getAttributeNS(NS.r, 'embed') ?? null;
  return { svgRid, pngRid };
}

function textRun(doc, text) {
  // Deliberately bare: the run properties of an equation image are only
  // <w:noProof/> and the baseline <w:position>, both meaningless for text and
  // the second one actively harmful. With no rPr the run inherits the paragraph.
  const run = doc.createElementNS(NS.w, 'w:r');
  const t   = doc.createElementNS(NS.w, 'w:t');
  t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
  t.appendChild(doc.createTextNode(text));
  run.appendChild(t);
  return run;
}

// Every r:id / r:embed still present anywhere in the body after the surgery.
function liveRelIds(doc) {
  const used = new Set();
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    for (const a of Array.from(el.attributes)) {
      if (a.namespaceURI === NS.r) used.add(a.value);
    }
  }
  return used;
}

// ---------------------------------------------------------------------- revert

/**
 * Turns every equation image of a .docx back into its source expression.
 *
 * -> { blob, results, restored, skipped }
 *    blob is null when the document carries no recoverable equation, so the
 *    caller can say so instead of handing back an identical file.
 */
export async function revertDocx(file, { onProgress, outputType = 'blob' } = {}) {
  const zip      = await JSZip.loadAsync(file);
  const docEntry = zip.file(DOC_PART);
  if (!docEntry) throw new Error('El archivo no parece un .docx (falta word/document.xml)');

  const doc     = parseXml(await docEntry.async('string'));
  const relsDoc = parseXml(await zip.file(RELS).async('string'));
  const rels    = relationships(relsDoc);

  // 1. Collect the candidates before touching the tree.
  const candidates = [];
  for (const drawing of findAll(doc.documentElement, NS.w, 'drawing')) {
    const refs = blipRefs(drawing);
    const run  = refs && ancestorRun(drawing);
    if (!run) continue;
    const target = rels.get(refs.svgRid);
    if (!target) continue;
    candidates.push({ run, path: partPath(target), ...refs });
  }
  if (!candidates.length) return { blob: null, results: [], restored: 0, skipped: 0 };

  // 2. Read each SVG and put the expression back in the run's place.
  const results = [];
  const dropped = [];
  let done = 0;

  for (const c of candidates) {
    onProgress?.({ done, total: candidates.length });
    done++;

    const entry = zip.file(c.path);
    if (!entry) { results.push({ ok: false, reason: 'missing' }); continue; }

    let meta = null;
    try { meta = parseSvgForLatex(await entry.async('string')); } catch { /* not one of ours */ }
    if (!meta?.formula) { results.push({ ok: false, reason: 'no-metadata' }); continue; }

    c.run.parentNode.replaceChild(textRun(doc, wrapFormula(meta.formula, meta.mode)), c.run);
    dropped.push(c);
    results.push({ ok: true, name: meta.name ?? null, mode: meta.mode, source: meta.formula });
  }
  onProgress?.({ done, total: candidates.length });

  const restored = results.filter(r => r.ok).length;
  if (!restored) return { blob: null, results, restored: 0, skipped: results.length };

  // 3. Drop the images nothing points at any more, so reverting twice does not
  //    leave a document fat with orphan media.
  const live = liveRelIds(doc);
  const gone = new Set();
  for (const c of dropped) {
    for (const rid of [c.svgRid, c.pngRid]) {
      if (!rid || live.has(rid) || gone.has(rid)) continue;
      gone.add(rid);
      const target = rels.get(rid);
      if (target) zip.remove(partPath(target));
    }
  }
  for (const r of findAll(relsDoc.documentElement, NS.rel, 'Relationship')) {
    if (gone.has(r.getAttribute('Id'))) r.parentNode.removeChild(r);
  }

  zip.file(DOC_PART, serialize(doc));
  zip.file(RELS,     serialize(relsDoc));

  const blob = await zip.generateAsync({
    type: outputType,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });

  return { blob, results, restored, skipped: results.length - restored };
}
