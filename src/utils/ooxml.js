// WordprocessingML plumbing: namespaces, unit conversion and the fragment parser
// used to splice generated XML into an existing .docx.
import { makeFragmentParser } from './xmlUtils';

export const NS = {
  w:    'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r:    'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp:   'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a:    'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic:  'http://schemas.openxmlformats.org/drawingml/2006/picture',
  asvg: 'http://schemas.microsoft.com/office/drawing/2016/SVG/main',
  a14:  'http://schemas.microsoft.com/office/drawing/2010/main',
  ct:   'http://schemas.openxmlformats.org/package/2006/content-types',
  rel:  'http://schemas.openxmlformats.org/package/2006/relationships',
};

export const EMU_PER_PT = 12700;

// The SVG extension marker Word looks for inside <a:blip>. Without it Word only
// ever shows the raster fallback.
export const SVG_EXT_URI = '{96DAC541-7B7A-43D3-8B79-37D633B846F1}';

// Word emits this alongside the SVG extension on every image it embeds itself.
// It carries no information we need, but matching Word's own output byte for byte
// is the safest thing to do with a renderer this undocumented.
export const DPI_EXT_URI = '{28A0092B-C50C-407E-A947-70E740481C1C}';

// Word stores font sizes in half-points; everything downstream works in points.
export const halfPointsToPt = v => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n / 2 : null;
};

export const ptToEmu = pt => Math.max(1, Math.round(pt * EMU_PER_PT));

export const parseFragment = makeFragmentParser(NS);
