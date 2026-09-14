import { buildExportSvg, svgToPngBlob, addPngLatexMetadata } from './svgUtils';

// MathJax never rejects on a bad expression, and it signals the two failure kinds
// differently. Both are read off the serialized SVG so the exact same rules can be
// exercised outside a browser.
//
//   1. Syntax errors produce an <merror> node carrying data-mjx-error with the
//      real message ("Missing close brace", "Missing \end{matrix}").
//   2. An unknown command is NOT an error: the noundefined extension typesets the
//      macro name in red and carries on, so '\fracc{1}{2}' would otherwise reach
//      the document as a perfectly valid SVG with red text in it.
export function detectError(svgHtml) {
  const explicit = /data-mjx-error="([^"]*)"/.exec(svgHtml);
  if (explicit) return unescapeAttr(explicit[1]);

  for (const [tag] of svgHtml.matchAll(/<g\b[^>]*>/g)) {
    if (!tag.includes('data-mml-node="mtext"') || !/\bfill="red"/.test(tag)) continue;
    // A red mtext whose LaTeX is a bare control sequence is noundefined's doing;
    // deliberately red text (\textcolor{red}{...}) never looks like that.
    const macro = /data-latex="(\\[a-zA-Z]+)"/.exec(tag);
    if (macro) return `Comando desconocido: ${unescapeAttr(macro[1])}`;
  }
  return null;
}

const unescapeAttr = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// MathJax viewBox units are 1/1000 em, so point sizes follow from the font size
// with no font metrics involved. The baseline sits at y = 0, which makes the part
// hanging below it exactly minY + height — and that is what an inline image has
// to be lowered by. Taking it from the viewBox avoids the ex-to-em ratio that the
// declared vertical-align would otherwise force us to guess (it is ~0.442, not
// the 0.5 everyone assumes, a 13% error on every inline equation).
export function geometry(viewBox, fontSize) {
  const [, y, w, h] = String(viewBox).trim().split(/[\s,]+/).map(Number);
  if ([y, w, h].some(n => !Number.isFinite(n))) {
    return { widthPt: fontSize, heightPt: fontSize, depthPt: 0 };
  }
  return {
    widthPt:  w / 1000 * fontSize,
    heightPt: h / 1000 * fontSize,
    depthPt:  Math.max(0, (y + h) / 1000 * fontSize),
  };
}

/**
 * Builds the `render` function that convertDocx injects. Kept apart from the
 * OOXML code so the injector can be exercised without MathJax or a canvas.
 */
export function createMathRenderer({ font = '' } = {}) {
  return async function render({ source, mode, display, fontSize, name }) {
    const mj = window.MathJax;
    const typeset = mode === 'asciimath' ? mj?.asciimath2svgPromise : mj?.tex2svgPromise;
    if (!typeset) throw new Error('MathJax no está listo');

    const container = await typeset.call(mj, source, { display });
    const svgs = container.querySelectorAll('svg');
    if (!svgs.length) throw new Error('MathJax no devolvió ningún SVG');
    // More than one means inline line-breaking is on and the expression came back
    // in pieces; keeping the first would silently drop the rest of the equation.
    if (svgs.length > 1) {
      throw new Error('MathJax devolvió la ecuación partida en trozos: ' +
        'falta svg.linebreaks.inline = false en la configuración');
    }
    const svgEl = svgs[0];

    const error = detectError(svgEl.outerHTML);
    if (error) throw new Error(error);

    const svg = buildExportSvg(svgEl, source, fontSize, mode, font, String(name));
    const png = await addPngLatexMetadata(await svgToPngBlob(svg, 3), source);

    return {
      svg,
      png: new Uint8Array(await png.arrayBuffer()),
      ...geometry(svgEl.getAttribute('viewBox'), fontSize),
    };
  };
}
