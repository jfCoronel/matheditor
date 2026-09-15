// Detection of inline math expressions in flowed document text.
//
// Two delimiters, longest first:
//   $$  ... $$   -> LaTeX      (mode 'tex')
//   $$$ ... $$$  -> AsciiMath  (mode 'asciimath')
//
// A single left-to-right scanner is used instead of two regex passes: '$$$'
// contains '$$', so independent passes mis-parse both '$$$a$$$' (leaves a
// stray '$') and '$$a$$$$b$$' (a literal '$$$' between two LaTeX formulas).
//
// Everything here is pure string/array work — no DOM — so the same core drives
// docx (w:r/w:t) and odt (text:span) and can be unit-tested outside a browser.

const DELIMITERS = [
  { open: '$$$', close: '$$$', mode: 'asciimath' },
  { open: '$$',  close: '$$',  mode: 'tex'       },
];

// Word/Writer autocorrect rewrites quotes and dashes as the user types, which
// silently breaks otherwise valid LaTeX. Undo it before handing text to MathJax.
const TYPOGRAPHY = [
  [/[“”]/g, '"'],
  [/[‘’]/g, "'"],
  [/[–—]/g, '-'],
  [/…/g,         '...'],
  [/ /g,         ' '],
];

// The inverse of scanFormulas: puts an equation back into the document as the
// source text it came from. Both reverters (docx and odt) go through here so the
// delimiters are written in exactly one place. The padding spaces are what people
// write by hand and what the scanner trims away, so restoring them makes the
// round trip land on the original text character for character.
export function wrapFormula(source, mode) {
  const d = DELIMITERS.find(x => x.mode === mode) ?? DELIMITERS[1];
  return `${d.open} ${source} ${d.close}`;
}

export function normalizeTypography(str) {
  return TYPOGRAPHY.reduce((s, [re, to]) => s.replace(re, to), str);
}

// Returns [{ start, end, mode, source }] in flat-text coordinates; end is exclusive
// and includes the closing delimiter.
export function scanFormulas(text) {
  const found = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] !== '$') { i++; continue; }

    let matched = false;
    for (const d of DELIMITERS) {
      if (!text.startsWith(d.open, i)) continue;

      const from    = i + d.open.length;
      const closeAt = text.indexOf(d.close, from);
      if (closeAt === -1) continue;            // unterminated: fall back to the shorter delimiter

      const source = text.slice(from, closeAt);
      if (!source.trim()) continue;            // '$$$$' and friends are not formulas

      found.push({ start: i, end: closeAt + d.close.length, mode: d.mode, source });
      i = closeAt + d.close.length;
      matched = true;
      break;
    }
    if (!matched) i++;
  }

  return found;
}

// Word splits a paragraph into runs at arbitrary points (spell-check, rsid, an
// invisible formatting change), so '$$x^2$$' routinely spans three runs and the
// delimiters themselves get cut in half. Flattening first is what makes the
// scanner reliable.
export function flattenRuns(runTexts) {
  let text = '';
  const spans = runTexts.map((t, run) => {
    const span = { run, start: text.length, end: text.length + t.length };
    text += t;
    return span;
  });
  return { text, spans };
}

function runAt(spans, pos) {
  const span = spans.find(s => pos >= s.start && pos < s.end);
  return span ? span.run : (spans.length ? spans[spans.length - 1].run : 0);
}

// Emits one item per original run overlapping [from, to), so each fragment keeps
// the formatting (w:rPr) of the run it came from. `whole` marks a fragment that
// covers its run entirely — the caller can pass that node through untouched.
function pushText(items, text, spans, from, to, emitted) {
  for (const s of spans) {
    // A run with no text of its own (a drawing, a field, a footnote reference)
    // has a zero-width span and would otherwise be dropped when the paragraph is
    // rebuilt. Emit it once, in the first range that reaches its position.
    if (s.start === s.end) {
      if (!emitted.has(s.run) && s.start >= from && s.start <= to) {
        emitted.add(s.run);
        items.push({ type: 'text', run: s.run, text: '', whole: true });
      }
      continue;
    }
    if (to <= from) continue;
    const a = Math.max(from, s.start);
    const b = Math.min(to,   s.end);
    if (b <= a) continue;
    items.push({
      type:  'text',
      run:   s.run,
      text:  text.slice(a, b),
      whole: a === s.start && b === s.end,
    });
  }
}

// A displayed equation is usually trailed by its number: '$$ x^2 $$ (1)', '(3.2)',
// '[4]'. That number is what the reader sees, so it becomes the equation's name
// instead of the automatic counter. The label stays in the document as text.
// Deliberately restricted to display formulas: after an inline one, '(2)' is far
// more likely to be prose ('la constante $$k$$ (2) veces') than a label.
const LABEL_RE = /^[\s\u00a0]*[([]([A-Za-z0-9][\w.\-]{0,15})[)\]]/;

function trailingLabel(text, from) {
  const m = LABEL_RE.exec(text.slice(from, from + 24));
  return m ? m[1] : null;
}

// Given the text of each run in one paragraph, returns the rebuilt run sequence,
// or null when the paragraph has no formulas and must be left alone.
//
// Formula items carry `run` (the original run the opening delimiter started in,
// so the caller can inherit its font size and run properties) and `display`.
export function planParagraph(runTexts) {
  const { text, spans } = flattenRuns(runTexts);
  const hits = scanFormulas(text);
  if (!hits.length) return null;

  const items = [];
  const emitted = new Set();
  let cursor = 0;

  for (const hit of hits) {
    pushText(items, text, spans, cursor, hit.start, emitted);
    const display = !text.slice(0, hit.start).trim();
    items.push({
      type:    'formula',
      run:     runAt(spans, hit.start),
      mode:    hit.mode,
      source:  normalizeTypography(hit.source).trim(),
      // Verbatim '$$…$$' text, put back untouched when the formula fails to render.
      raw:     text.slice(hit.start, hit.end),
      // Display when nothing precedes the formula in the paragraph. What FOLLOWS
      // is deliberately ignored: a displayed equation is often trailed by a
      // hand-written number, and '$$ x^2 $$ (1)' is still display. An earlier
      // formula counts as preceding content because its delimiters are in `text`.
      display,
      label: display ? trailingLabel(text, hit.end) : null,
    });
    cursor = hit.end;
  }
  pushText(items, text, spans, cursor, text.length, emitted);

  return { items, formulas: items.filter(i => i.type === 'formula') };
}

// Assigns the final name of every formula, in document order. A hand-written
// label wins; the rest get the automatic 1..n counter, skipping any number
// already claimed as a label so the two numbering schemes never collide.
// `reserved` carries the names of equations converted in a previous pass, so
// re-processing a document numbers the new ones from there without renaming
// the existing ones. Mutates and returns the items it is given.
export function assignNames(formulas, reserved = []) {
  const taken = new Set([
    ...reserved,
    ...formulas.map(f => f.label).filter(Boolean),
  ]);
  let n = 0;
  for (const f of formulas) {
    if (f.label) { f.name = f.label; continue; }
    do { n++; } while (taken.has(String(n)));
    f.name = String(n);
    taken.add(f.name);
  }
  return formulas;
}
