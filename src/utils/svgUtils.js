export function escapeXml(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

export function unescapeXml(str) {
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Encode LaTeX as URL-safe base64 for use in an XML id attribute.
// XML ids can contain: letters, digits, '-', '_', '.', ':' — standard base64
// uses '+', '/' and '=' which are not allowed, so we use the URL-safe variant.
export function encodeLatexId(latex) {
  const bytes = new TextEncoder().encode(latex);
  const b64   = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
  return 'lxs-' + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// MathJax SVG viewBox units: 1 unit = 1/1000 em.
// Given a desired font size in pt, we can convert viewBox dimensions to pt:
//   width_pt  = viewBox_width  / 1000 * fontSize_pt
//   height_pt = viewBox_height / 1000 * fontSize_pt
function applyPtDimensions(svgEl, fontSize) {
  const vb = svgEl.getAttribute('viewBox');
  if (!vb) return;
  const parts = vb.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return;
  const [, , vbW, vbH] = parts;
  svgEl.setAttribute('width',  `${(vbW / 1000 * fontSize).toFixed(3)}pt`);
  svgEl.setAttribute('height', `${(vbH / 1000 * fontSize).toFixed(3)}pt`);
}

export function buildExportSvg(svgEl, latex, fontSize = 12) {
  const ns    = 'http://www.w3.org/2000/svg';
  const clone = svgEl.cloneNode(true);

  applyPtDimensions(clone, fontSize);

  clone.setAttribute('xmlns',       ns);
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  // id encodes the LaTeX in base64url — survives Word's SVG processing
  clone.setAttribute('id', encodeLatexId(latex));

  // <metadata> for LibreOffice, Inkscape and other SVG-aware tools
  const meta = document.createElementNS(ns, 'metadata');
  meta.innerHTML =
    '<latex-source xmlns="https://schemas.latexeditor.app/1.0">' +
    escapeXml(latex) +
    '</latex-source>';
  clone.insertBefore(meta, clone.firstChild);

  // Word/PowerPoint don't inherit a CSS color context, so currentColor resolves
  // to white/undefined. Replace it with an explicit black before exporting.
  return new XMLSerializer().serializeToString(clone).replace(/currentColor/g, 'black');
}

export { applyPtDimensions };

export async function svgToPngBlob(svgString, scale = 3) {
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.src = url;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

    const canvas = document.createElement('canvas');
    canvas.width  = img.naturalWidth  * scale;
    canvas.height = img.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);

    return await new Promise((res, rej) =>
      canvas.toBlob(b => (b ? res(b) : rej(new Error('toBlob devolvió null'))), 'image/png')
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Injects a PNG tEXt chunk with the LaTeX source after the IHDR chunk.
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export async function addPngLatexMetadata(pngBlob, latex) {
  const enc  = new TextEncoder();
  const key  = enc.encode('LaTeX');
  const val  = enc.encode(latex);

  const data = new Uint8Array(key.length + 1 + val.length);
  data.set(key);
  data[key.length] = 0;
  data.set(val, key.length + 1);

  const type    = enc.encode('tEXt');
  const crcSrc  = new Uint8Array(4 + data.length);
  crcSrc.set(type);
  crcSrc.set(data, 4);

  const chunk = new Uint8Array(12 + data.length);
  const dv    = new DataView(chunk.buffer);
  dv.setUint32(0, data.length, false);
  chunk.set(type, 4);
  chunk.set(data, 8);
  dv.setUint32(8 + data.length, crc32(crcSrc), false);

  // PNG signature (8 B) + IHDR chunk (4+4+13+4 = 25 B) = 33 B; insert right after
  const orig = new Uint8Array(await pngBlob.arrayBuffer());
  const out  = new Uint8Array(orig.length + chunk.length);
  out.set(orig.slice(0, 33));
  out.set(chunk, 33);
  out.set(orig.slice(33), 33 + chunk.length);

  return new Blob([out], { type: 'image/png' });
}
