import JSZip from 'jszip';
import { planParagraph, assignNames } from './docxMath';
import { parseSvgForLatex } from './svgLoader';
import { escapeXml, parseXml, serialize, findAll, makeFragmentParser } from './xmlUtils';

export const ODF = {
  office:   'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  text:     'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  draw:     'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
  style:    'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  svg:      'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0',
  fo:       'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  xlink:    'http://www.w3.org/1999/xlink',
  dc:       'http://purl.org/dc/elements/1.1/',
  manifest: 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0',
};

const parseFragment = makeFragmentParser(ODF);

const CONTENT  = 'content.xml';
const MANIFEST = 'META-INF/manifest.xml';
const PICTURES = 'Pictures/';

// ---------------------------------------------------------------- reading text

// Flat text of one paragraph child. text:s / text:tab / text:line-break carry no
// characters but do occupy a position, so they map to spaces, '\t' and '\n' and
// are rebuilt from those same characters later. Frames and annotations contribute
// nothing: they get a zero-width span and are preserved untouched.
function deepText(n) {
  if (n.nodeType === 3) return n.nodeValue ?? '';
  if (n.nodeType !== 1) return '';

  if (n.namespaceURI === ODF.text) {
    if (n.localName === 's')          return ' '.repeat(Math.max(1, parseInt(n.getAttributeNS(ODF.text, 'c'), 10) || 1));
    if (n.localName === 'tab')        return '\t';
    if (n.localName === 'line-break') return '\n';
  }
  if (n.namespaceURI === ODF.draw || n.namespaceURI === ODF.office) return '';

  return Array.from(n.childNodes).map(deepText).join('');
}

// ODF collapses runs of whitespace, so anything beyond a single space has to be
// written as <text:s text:c="n"/> — the same shape LibreOffice writes itself.
export function textNodes(str, doc) {
  const out  = [];
  const push = s => { if (s) out.push(doc.createTextNode(s)); };
  const re   = /( {2,}|\t|\n)/g;
  let last = 0, m;

  while ((m = re.exec(str))) {
    push(str.slice(last, m.index));
    if (m[0] === '\t')      out.push(doc.createElementNS(ODF.text, 'text:tab'));
    else if (m[0] === '\n') out.push(doc.createElementNS(ODF.text, 'text:line-break'));
    else {
      push(' ');
      const s = doc.createElementNS(ODF.text, 'text:s');
      s.setAttributeNS(ODF.text, 'text:c', String(m[0].length - 1));
      out.push(s);
    }
    last = re.lastIndex;
  }
  push(str.slice(last));
  return out;
}

const isSpan = n => n?.nodeType === 1 && n.namespaceURI === ODF.text && (n.localName === 'span' || n.localName === 'a');

// A fragment cut out of a styled span keeps that span, so formatting survives.
function rebuildText(proto, text, doc) {
  if (!isSpan(proto)) return textNodes(text, doc);
  const clone = proto.cloneNode(false);
  for (const n of textNodes(text, doc)) clone.appendChild(n);
  return [clone];
}

async function defaultFontSize(zip) {
  const styles = zip.file('styles.xml');
  if (!styles) return 12;
  try {
    const doc = parseXml(await styles.async('string'));
    for (const def of findAll(doc.documentElement, ODF.style, 'default-style')) {
      if (def.getAttributeNS(ODF.style, 'family') !== 'paragraph') continue;
      const props = findAll(def, ODF.style, 'text-properties')[0];
      const size  = props && parseFloat(props.getAttributeNS(ODF.fo, 'font-size'));
      if (Number.isFinite(size) && size > 0) return size;
    }
  } catch { /* usamos el valor por defecto */ }
  return 12;
}

// ------------------------------------------------------------------- fragments

// One style for every equation: Writer already seats an as-char frame correctly on
// the baseline with its own defaults. Computing an explicit svg:y from the SVG's
// depth — the equivalent of what w:position does in Word — was tried and pushed
// the equations visibly below the line, so the arithmetic is left to Writer.
const STYLE_NAME = 'MathEditorEq';

const styleXml = () =>
  `<style:style style:name="${STYLE_NAME}" style:family="graphic" style:parent-style-name="Graphics">` +
    `<style:graphic-properties style:vertical-pos="top" style:vertical-rel="baseline" ` +
    `style:mirror="none" fo:border="none"/>` +
  `</style:style>`;

function frameXml({ styleName, name, href, widthPt, heightPt }) {
  return (
    `<draw:frame draw:style-name="${styleName}" draw:name="${escapeXml(name)}" ` +
      `text:anchor-type="as-char" svg:width="${widthPt.toFixed(3)}pt" ` +
      `svg:height="${heightPt.toFixed(3)}pt" draw:z-index="0">` +
      `<draw:image xlink:href="${escapeXml(href)}" xlink:type="simple" xlink:show="embed" ` +
      `xlink:actuate="onLoad" draw:mime-type="image/svg+xml"/>` +
    `</draw:frame>`
  );
}

// ODF comments live inline in the paragraph — no separate part, unlike docx.
function annotationXml(text) {
  return (
    `<office:annotation>` +
      `<dc:creator>MathEditor</dc:creator>` +
      `<dc:date>${new Date().toISOString().replace(/\.\d+Z$/, '')}</dc:date>` +
      `<text:p>${escapeXml(text)}</text:p>` +
    `</office:annotation>`
  );
}

// ------------------------------------------------------------- package surgery

function automaticStyles(doc) {
  const existing = findAll(doc.documentElement, ODF.office, 'automatic-styles')[0];
  if (existing) return existing;
  const created = doc.createElementNS(ODF.office, 'office:automatic-styles');
  const body    = findAll(doc.documentElement, ODF.office, 'body')[0];
  doc.documentElement.insertBefore(created, body ?? null);
  return created;
}

function addManifestEntry(mDoc, path, mediaType) {
  const already = findAll(mDoc.documentElement, ODF.manifest, 'file-entry')
    .some(e => e.getAttributeNS(ODF.manifest, 'full-path') === path);
  if (already) return;
  const entry = mDoc.createElementNS(ODF.manifest, 'manifest:file-entry');
  entry.setAttributeNS(ODF.manifest, 'manifest:full-path', path);
  entry.setAttributeNS(ODF.manifest, 'manifest:media-type', mediaType);
  mDoc.documentElement.appendChild(entry);
}

async function reservedNames(zip) {
  const names = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !path.startsWith(PICTURES) || !path.toLowerCase().endsWith('.svg')) continue;
    try {
      const meta = parseSvgForLatex(await entry.async('string'));
      if (meta?.name) names.push(meta.name);
    } catch { /* no es de los nuestros */ }
  }
  return names;
}

const safeName = name => String(name).replace(/[^A-Za-z0-9._-]/g, '_');

// ------------------------------------------------------------------ conversion

/**
 * Replaces every $$…$$ / $$$…$$$ expression in an .odt with an SVG image.
 *
 * Same `render` contract as convertDocx. Writer reads SVG natively, so no raster
 * fallback is embedded — the png the renderer returns is simply not used.
 */
export async function convertOdt(file, { render, onProgress, outputType = 'blob' } = {}) {
  if (typeof render !== 'function') throw new Error('convertOdt necesita una función render');

  const zip     = await JSZip.loadAsync(file);
  const content = zip.file(CONTENT);
  if (!content) throw new Error('El archivo no parece un .odt (falta content.xml)');

  const doc        = parseXml(await content.async('string'));
  const fallbackPt = await defaultFontSize(zip);

  const jobs = [];
  for (const name of ['p', 'h']) {
    for (const p of findAll(doc.documentElement, ODF.text, name)) {
      const nodes = Array.from(p.childNodes);
      if (!nodes.length) continue;
      const plan = planParagraph(nodes.map(deepText));
      if (plan) jobs.push({ p, nodes, plan });
    }
  }
  const formulas = jobs.flatMap(j => j.plan.formulas);
  if (!formulas.length) return { blob: null, results: [], converted: 0, failed: 0 };

  assignNames(formulas, await reservedNames(zip));

  const media   = [];
  const results = [];
  let done = 0;

  for (const job of jobs) {
    for (const f of job.plan.formulas) {
      onProgress?.({ done, total: formulas.length, name: f.name });
      try {
        const out  = await render({ source: f.source, mode: f.mode, display: f.display,
                                    fontSize: fallbackPt, name: f.name });
        const base = `eq-${safeName(f.name)}`;
        const href = `${PICTURES}${base}.svg`;
        media.push({ path: href, data: out.svg });

        f.nodes = parseFragment(frameXml({
          styleName: STYLE_NAME, name: `Ecuación ${f.name}`, href,
          widthPt: out.widthPt, heightPt: out.heightPt,
        }), doc);

        results.push({ name: f.name, mode: f.mode, display: f.display, source: f.source, ok: true });
      } catch (e) {
        const kind = f.mode === 'asciimath' ? 'AsciiMath' : 'LaTeX';
        f.nodes = [
          ...parseFragment(annotationXml(`Error de ${kind}: ${e.message}`), doc),
          ...rebuildText(job.nodes[f.run], f.raw, doc),
        ];
        results.push({ name: f.name, mode: f.mode, display: f.display, source: f.source,
                       ok: false, error: e.message });
      }
      done++;
    }
  }
  onProgress?.({ done, total: formulas.length });

  for (const { p, nodes, plan } of jobs) {
    const rebuilt = [];
    for (const item of plan.items) {
      if (item.type === 'formula')  rebuilt.push(...item.nodes);
      else if (item.whole)          rebuilt.push(nodes[item.run]);
      else                          rebuilt.push(...rebuildText(nodes[item.run], item.text, doc));
    }
    // Same dance as the docx side: detach first, because `rebuilt` reuses nodes
    // that are still in the tree and inserting one before itself is not portable.
    const marker = doc.createElementNS(ODF.text, 'text:span');
    p.insertBefore(marker, nodes[0]);
    for (const n of nodes) p.removeChild(n);
    for (const n of rebuilt) p.insertBefore(n, marker);
    p.removeChild(marker);
  }

  const stylesEl = automaticStyles(doc);
  for (const n of parseFragment(styleXml(), doc)) stylesEl.appendChild(n);

  for (const m of media) zip.file(m.path, m.data);

  const manifest = zip.file(MANIFEST);
  if (manifest) {
    const mDoc = parseXml(await manifest.async('string'));
    for (const m of media) addManifestEntry(mDoc, m.path, 'image/svg+xml');
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

  return {
    blob,
    results,
    converted: results.filter(r => r.ok).length,
    failed:    results.filter(r => !r.ok).length,
  };
}
