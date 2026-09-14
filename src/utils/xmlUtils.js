// Generic XML plumbing shared by the OOXML (docx) and ODF (odt) injectors.

export const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

export function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) throw new Error(`XML no válido: ${err.textContent.slice(0, 200)}`);
  return doc;
}

export function serialize(doc) {
  // Browsers drop the XML declaration when serializing; other implementations
  // keep it as a node. Emitting it twice makes the part be rejected outright.
  const xml = new XMLSerializer().serializeToString(doc);
  return xml.startsWith('<?xml') ? xml : XML_DECL + xml;
}

// Builds nodes from an XML string with the given prefixes predeclared, so
// fragments can be written with their natural prefixes instead of a pile of
// createElementNS calls.
export function makeFragmentParser(nsMap) {
  const decls = Object.entries(nsMap).map(([p, u]) => `xmlns:${p}="${u}"`).join(' ');
  return function parseFragment(xml, doc) {
    const parsed = new DOMParser().parseFromString(`<x ${decls}>${xml}</x>`, 'application/xml');
    const err = parsed.getElementsByTagName('parsererror')[0];
    if (err) throw new Error(`XML generado no válido: ${err.textContent.slice(0, 200)}`);
    return Array.from(parsed.documentElement.childNodes).map(n => doc.importNode(n, true));
  };
}

export const childrenNS = (el, ns, name) =>
  Array.from(el.childNodes).filter(n => n.nodeType === 1 && n.namespaceURI === ns && n.localName === name);

export const findAll = (root, ns, name) => Array.from(root.getElementsByTagNameNS(ns, name));
