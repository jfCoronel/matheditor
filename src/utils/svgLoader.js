import { unescapeXml } from './svgUtils';

function decodeLatexId(id) {
  let encoded, mode;
  if (id.startsWith('lxs-tex-')) {
    encoded = id.slice(8); mode = 'tex';
  } else if (id.startsWith('lxs-asc-')) {
    encoded = id.slice(8); mode = 'asciimath';
  } else {
    // Legacy format lxs-{b64} — assume tex
    encoded = id.slice(4); mode = 'tex';
  }
  const b64    = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '=='.slice(0, (4 - b64.length % 4) % 4);
  const bytes  = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
  return { formula: new TextDecoder().decode(bytes), mode };
}

// Returns { formula, mode } or null if no metadata found.
// mode is 'tex' | 'asciimath', defaults to 'tex' for backwards compatibility.
export function parseSvgForLatex(svgText) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl  = doc.querySelector('svg');
  let formula  = null;
  let mode     = 'tex';

  // Method 1: <latex-source mode="..."> inside <metadata> — current format
  const lsEl = doc.querySelector('latex-source');
  if (lsEl) {
    formula = lsEl.textContent;
    const m = lsEl.getAttribute('mode');
    if (m === 'asciimath') mode = 'asciimath';
  }

  // Method 2: id="lxs-{base64url}" — survives Word; mode encoded in prefix since lxs-tex-/lxs-asc-
  if (!formula && svgEl?.id?.startsWith('lxs-')) {
    try { ({ formula, mode } = decodeLatexId(svgEl.id)); } catch { /* malformed */ }
  }

  // Method 3: data-latex — backwards compat
  if (!formula && svgEl) formula = svgEl.getAttribute('data-latex');

  if (!formula) return null;
  return { formula: unescapeXml(formula.trim()), mode };
}
