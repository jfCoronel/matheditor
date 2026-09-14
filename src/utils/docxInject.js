import JSZip from 'jszip';
import { planParagraph, assignNames } from './docxMath';
import { parseSvgForLatex } from './svgLoader';
import { NS, SVG_EXT_URI, DPI_EXT_URI, parseFragment, halfPointsToPt, ptToEmu } from './ooxml';
import { escapeXml, parseXml, serialize, childrenNS, findAll } from './xmlUtils';

const XML_NS   = 'http://www.w3.org/XML/1998/namespace';
const DOC_PART = 'word/document.xml';
const RELS     = 'word/_rels/document.xml.rels';
const TYPES    = '[Content_Types].xml';
const COMMENTS = 'word/comments.xml';

const CT = {
  svg:      'image/svg+xml',
  png:      'image/png',
  comments: 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml',
};
const REL_TYPE = {
  image:    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  comments: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',
};

// ---------------------------------------------------------------- reading text

// Flat text of one run. w:tab and w:br carry no characters of their own but do
// occupy a position, so they map to '\t' and '\n' and are rebuilt from those same
// characters later — the round trip is lossless for all three.
function runText(run) {
  let out = '';
  for (const n of run.childNodes) {
    if (n.nodeType !== 1 || n.namespaceURI !== NS.w) continue;
    if      (n.localName === 't')   out += n.textContent;
    else if (n.localName === 'tab') out += '\t';
    else if (n.localName === 'br')  out += '\n';
  }
  return out;
}

function makeRun(proto, text, doc) {
  const run = doc.createElementNS(NS.w, 'w:r');
  const rPr = proto && childrenNS(proto, NS.w, 'rPr')[0];
  if (rPr) run.appendChild(rPr.cloneNode(true));

  for (const seg of text.split(/(\t|\n)/)) {
    if (seg === '')        continue;
    if (seg === '\t')      run.appendChild(doc.createElementNS(NS.w, 'w:tab'));
    else if (seg === '\n') run.appendChild(doc.createElementNS(NS.w, 'w:br'));
    else {
      const t = doc.createElementNS(NS.w, 'w:t');
      t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
      t.appendChild(doc.createTextNode(seg));
      run.appendChild(t);
    }
  }
  return run;
}

// Font size in points: run properties win, then the paragraph mark, then the
// document defaults. Word stores all three as w:sz in half-points.
function sizeOf(el) {
  if (!el) return null;
  const rPr = childrenNS(el, NS.w, 'rPr')[0] || childrenNS(el, NS.w, 'pPr')[0];
  const sz  = rPr && findAll(rPr, NS.w, 'sz')[0];
  return sz ? halfPointsToPt(sz.getAttributeNS(NS.w, 'val') || sz.getAttribute('w:val')) : null;
}

function fontSizeFor(run, paragraph, fallback) {
  return sizeOf(run) ?? sizeOf(paragraph) ?? fallback;
}

async function defaultFontSize(zip) {
  const styles = zip.file('word/styles.xml');
  if (!styles) return 12;
  try {
    const doc = parseXml(await styles.async('string'));
    const def = findAll(doc.documentElement, NS.w, 'rPrDefault')[0];
    return (def && sizeOf(def)) ?? 12;
  } catch { return 12; }
}

// ------------------------------------------------------------- package surgery

function nextRelId(relsDoc) {
  const used = findAll(relsDoc.documentElement, NS.rel, 'Relationship')
    .map(r => parseInt((r.getAttribute('Id') || '').replace(/^rId/, ''), 10))
    .filter(Number.isFinite);
  let n = Math.max(0, ...used) + 1;
  return () => `rId${n++}`;
}

function addRelationship(relsDoc, id, type, target) {
  const rel = relsDoc.createElementNS(NS.rel, 'Relationship');
  rel.setAttribute('Id', id);
  rel.setAttribute('Type', type);
  rel.setAttribute('Target', target);
  relsDoc.documentElement.appendChild(rel);
}

function ensureContentTypes(ctDoc, extensions, overrides) {
  const root = ctDoc.documentElement;
  const haveDefault  = new Set(findAll(root, NS.ct, 'Default').map(d => (d.getAttribute('Extension') || '').toLowerCase()));
  const haveOverride = new Set(findAll(root, NS.ct, 'Override').map(o => o.getAttribute('PartName')));

  for (const ext of extensions) {
    if (haveDefault.has(ext)) continue;
    const d = ctDoc.createElementNS(NS.ct, 'Default');
    d.setAttribute('Extension', ext);
    d.setAttribute('ContentType', CT[ext]);
    root.appendChild(d);
  }
  for (const [part, type] of overrides) {
    if (haveOverride.has(part)) continue;
    const o = ctDoc.createElementNS(NS.ct, 'Override');
    o.setAttribute('PartName', part);
    o.setAttribute('ContentType', type);
    root.appendChild(o);
  }
}

// Names already used by equations converted in an earlier pass, so re-running the
// conversion never renames what is already in the document.
async function reservedNames(zip) {
  const names = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !path.startsWith('word/media/') || !path.toLowerCase().endsWith('.svg')) continue;
    try {
      const meta = parseSvgForLatex(await entry.async('string'));
      if (meta?.name) names.push(meta.name);
    } catch { /* not one of ours */ }
  }
  return names;
}

const safeName = name => String(name).replace(/[^A-Za-z0-9._-]/g, '_');

// ------------------------------------------------------------------- fragments

function imageRunXml({ docPrId, name, source, pngRid, svgRid, widthPt, heightPt, positionHalfPt }) {
  const cx = ptToEmu(widthPt);
  const cy = ptToEmu(heightPt);
  const position = positionHalfPt ? `<w:position w:val="${positionHalfPt}"/>` : '';
  const file = `eq-${safeName(name)}`;

  return (
    `<w:r><w:rPr><w:noProof/>${position}</w:rPr><w:drawing>` +
      `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
        `<wp:extent cx="${cx}" cy="${cy}"/>` +
        `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
        `<wp:docPr id="${docPrId}" name="Ecuación ${escapeXml(name)}" descr="${escapeXml(source)}"/>` +
        `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
        `<a:graphic><a:graphicData uri="${NS.pic}">` +
          `<pic:pic>` +
            `<pic:nvPicPr><pic:cNvPr id="0" name="${file}.svg"/><pic:cNvPicPr/></pic:nvPicPr>` +
            // Word requires a raster blip; the SVG rides along in the extension
            // list and is what Word 2016+ actually draws.
            `<pic:blipFill><a:blip r:embed="${pngRid}"><a:extLst>` +
              `<a:ext uri="${DPI_EXT_URI}"><a14:useLocalDpi val="0"/></a:ext>` +
              `<a:ext uri="${SVG_EXT_URI}"><asvg:svgBlip r:embed="${svgRid}"/></a:ext>` +
            `</a:extLst></a:blip><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
            `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
            `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
          `</pic:pic>` +
        `</a:graphicData></a:graphic>` +
      `</wp:inline>` +
    `</w:drawing></w:r>`
  );
}

const commentsShellXml = () => `<w:comments xmlns:w="${NS.w}"></w:comments>`;

function commentXml(id, text) {
  return (
    `<w:comment w:id="${id}" w:author="MathEditor" w:initials="ME" w:date="${new Date().toISOString()}">` +
      `<w:p><w:r><w:annotationRef/></w:r>` +
      `<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>` +
    `</w:comment>`
  );
}

// ------------------------------------------------------------------ conversion

/**
 * Replaces every $$…$$ / $$$…$$$ expression in a .docx with an SVG image.
 *
 * `render` does the actual typesetting and is injected so this module stays free
 * of MathJax and canvas:
 *   render({ source, mode, display, fontSize, name })
 *     -> { svg: string, png: Uint8Array, widthPt, heightPt, depthPt }
 *     -> throws Error when the expression does not typeset
 *
 * A formula that fails is left in the document exactly as written and gets a Word
 * comment anchored to it carrying the error.
 */
export async function convertDocx(file, { render, onProgress, outputType = 'blob' } = {}) {
  if (typeof render !== 'function') throw new Error('convertDocx necesita una función render');

  const zip = await JSZip.loadAsync(file);
  const docEntry = zip.file(DOC_PART);
  if (!docEntry) throw new Error('El archivo no parece un .docx (falta word/document.xml)');

  const doc        = parseXml(await docEntry.async('string'));
  const fallbackPt = await defaultFontSize(zip);

  // 1. Plan every paragraph before touching anything.
  const jobs = [];
  for (const p of findAll(doc.documentElement, NS.w, 'p')) {
    const runs = childrenNS(p, NS.w, 'r');
    if (!runs.length) continue;
    const plan = planParagraph(runs.map(runText));
    if (plan) jobs.push({ p, runs, plan });
  }
  const formulas = jobs.flatMap(j => j.plan.formulas);
  if (!formulas.length) return { blob: null, results: [], converted: 0, failed: 0 };

  assignNames(formulas, await reservedNames(zip));

  // 2. Typeset. Failures are recorded, never thrown — the whole point is that a
  //    bad expression must not abort the other ninety-nine.
  const relsDoc = parseXml(await zip.file(RELS).async('string'));
  const newRid  = nextRelId(relsDoc);
  const docPrId = (() => {
    const used = findAll(doc.documentElement, NS.wp, 'docPr')
      .map(d => parseInt(d.getAttribute('id'), 10)).filter(Number.isFinite);
    let n = Math.max(1000, ...used) + 1;
    return () => n++;
  })();

  const media    = [];
  const comments = [];
  const results  = [];
  let done = 0;

  for (const job of jobs) {
    for (const f of job.plan.formulas) {
      const fontSize = fontSizeFor(job.runs[f.run], job.p, fallbackPt);
      onProgress?.({ done, total: formulas.length, name: f.name });

      try {
        const out = await render({ source: f.source, mode: f.mode, display: f.display, fontSize, name: f.name });

        const base    = `eq-${safeName(f.name)}`;
        const svgRid  = newRid();
        const pngRid  = newRid();
        media.push({ path: `word/media/${base}.svg`, data: out.svg });
        media.push({ path: `word/media/${base}.png`, data: out.png });
        addRelationship(relsDoc, svgRid, REL_TYPE.image, `media/${base}.svg`);
        addRelationship(relsDoc, pngRid, REL_TYPE.image, `media/${base}.png`);

        // An inline image sits on the baseline, so it has to be pushed down by
        // whatever the equation hangs below it. w:position is in half-points and
        // positive raises. A display equation is alone on its line: leave it be.
        const positionHalfPt = f.display ? 0 : -Math.round(out.depthPt * 2);

        f.nodes = parseFragment(imageRunXml({
          docPrId: docPrId(), name: f.name, source: f.source,
          pngRid, svgRid, widthPt: out.widthPt, heightPt: out.heightPt, positionHalfPt,
        }), doc);

        results.push({ name: f.name, mode: f.mode, display: f.display, source: f.source, ok: true });
      } catch (e) {
        const id   = comments.length + 1;
        const kind = f.mode === 'asciimath' ? 'AsciiMath' : 'LaTeX';
        comments.push({ id, text: `Error de ${kind}: ${e.message}` });

        const start = parseFragment(`<w:commentRangeStart w:id="${id}"/>`, doc);
        const end   = parseFragment(
          `<w:commentRangeEnd w:id="${id}"/><w:r><w:commentReference w:id="${id}"/></w:r>`, doc);
        f.nodes = [...start, makeRun(job.runs[f.run], f.raw, doc), ...end];

        results.push({ name: f.name, mode: f.mode, display: f.display, source: f.source,
                       ok: false, error: e.message });
      }
      done++;
    }
  }
  onProgress?.({ done, total: formulas.length });

  // 3. Rewrite the paragraphs.
  for (const { p, runs, plan } of jobs) {
    const anchor = runs[0];
    const rebuilt = [];
    for (const item of plan.items) {
      if (item.type === 'formula')  rebuilt.push(...item.nodes);
      else if (item.whole)          rebuilt.push(runs[item.run]);          // untouched: reuse as is
      else                          rebuilt.push(makeRun(runs[item.run], item.text, doc));
    }

    // Detach the original runs first, then rebuild at the marked spot: `rebuilt`
    // reuses untouched run nodes, and inserting one before itself is not portable.
    const marker = doc.createElementNS(NS.w, 'w:r');
    p.insertBefore(marker, anchor);
    for (const run of runs) p.removeChild(run);
    for (const node of rebuilt) p.insertBefore(node, marker);
    p.removeChild(marker);
    // Spell-check markers point at run boundaries that no longer exist.
    for (const pe of childrenNS(p, NS.w, 'proofErr')) p.removeChild(pe);
  }

  // 4. Package parts.
  for (const m of media) zip.file(m.path, m.data);

  const extensions = media.length ? ['svg', 'png'] : [];
  const overrides  = [];

  if (comments.length) {
    const existing  = zip.file(COMMENTS);
    const cDoc      = parseXml(existing ? await existing.async('string') : commentsShellXml());
    const usedIds   = findAll(cDoc.documentElement, NS.w, 'comment')
      .map(c => parseInt(c.getAttributeNS(NS.w, 'id'), 10)).filter(Number.isFinite);
    const shift     = usedIds.length ? Math.max(...usedIds) + 1 : 0;

    for (const c of comments) {
      const id = c.id + shift;
      if (shift) retargetComment(doc, c.id, id);
      cDoc.documentElement.appendChild(parseFragment(commentXml(id, c.text), cDoc)[0]);
    }
    zip.file(COMMENTS, serialize(cDoc));

    if (!existing) {
      addRelationship(relsDoc, newRid(), REL_TYPE.comments, 'comments.xml');
      overrides.push([`/${COMMENTS}`, CT.comments]);
    }
  }

  const ctDoc = parseXml(await zip.file(TYPES).async('string'));
  ensureContentTypes(ctDoc, extensions, overrides);
  zip.file(TYPES, serialize(ctDoc));
  zip.file(RELS,  serialize(relsDoc));
  zip.file(DOC_PART, serialize(doc));

  const blob = await zip.generateAsync({
    type: outputType,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });

  return {
    blob,
    results,
    converted: results.filter(r => r.ok).length,
    failed:    results.filter(r => !r.ok).length,
  };
}

// Shifts the ids of the comment anchors already placed in the body, for the case
// where the document had comments of its own.
function retargetComment(doc, from, to) {
  for (const name of ['commentRangeStart', 'commentRangeEnd', 'commentReference']) {
    for (const el of findAll(doc.documentElement, NS.w, name)) {
      if (el.getAttributeNS(NS.w, 'id') === String(from)) el.setAttributeNS(NS.w, 'w:id', String(to));
    }
  }
}
