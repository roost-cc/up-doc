/**
 * Pure helpers for pulling link targets out of markdown text.
 *
 * The link checker reads links from the raw markdown with a regex. Markdown
 * renderers never turn code into links, so link syntax inside fenced code
 * blocks and inline code spans is stripped before the regex runs. Only the
 * CommonMark rules that matter for that are implemented here; indented
 * (four-space) code blocks are deliberately not recognised.
 */

/**
 * Prefix allowed before a fence line: up to three spaces of indent, optionally
 * preceded by blockquote markers (`> `) which may themselves be indented.
 */
const FENCE_PREFIX = String.raw`^(?: {0,3}>[ \t]?)* {0,3}`;

/**
 * Matches a line shaped like an opening fence, with any indent, and captures
 * the indent, the fence run and the info string. The indent decides whether
 * the line is a fence (up to three spaces) or indented code (four or more
 * columns; a tab counts as four).
 */
const FENCE_LIKE = /^(?: {0,3}>[ \t]?)*([ \t]*)(`{3,}|~{3,})(.*?)\r?$/;

/** @param {string} indent the whitespace before a fence-shaped run */
const isIndentedCode = (indent) => indent.length >= 4 || indent.includes('\t');

/**
 * Replace every fenced code block (``` or ~~~) with blank lines.
 *
 * An opening fence is three or more backticks or tildes, optionally followed
 * by an info string (a backtick fence's info string may not contain a
 * backtick). The closing fence uses the same character, is at least as long,
 * and has nothing but whitespace after it. An unclosed fence runs to the end
 * of the text. Line count is preserved.
 *
 * @param {string} text markdown source
 * @returns {string} the same text with fenced blocks blanked out
 */
export function stripFencedCode(text) {
  const lines = text.split('\n');
  /** @type {RegExp | null} */
  let closeRe = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (closeRe) {
      lines[i] = '';
      if (closeRe.test(line)) closeRe = null;
      continue;
    }
    const m = FENCE_LIKE.exec(line);
    if (!m) continue;
    const [, indent, fence, info] = m;
    if (isIndentedCode(indent)) {
      // Indented code, not a fence: neutralise only the run so it can neither
      // open a fence nor open a span across the prose that follows. The rest
      // of the line stays, so a link on it is still checked.
      lines[i] = line.replace(fence, ' ');
      continue;
    }
    const ch = fence[0];
    if (ch === '`' && info.includes('`')) continue;
    closeRe = new RegExp(FENCE_PREFIX + `${ch}{${fence.length},}[ \\t\\r]*$`);
    lines[i] = '';
  }
  return lines.join('\n');
}

/**
 * Replace every inline code span with a single space.
 *
 * A run of n backticks opens a span that is closed by the next run of exactly
 * n backticks (possibly on a later line). A run with no matching close is
 * literal text and is left in place.
 *
 * @param {string} text markdown source
 * @returns {string} the same text with code spans replaced by a space
 */
export function stripCodeSpans(text) {
  /** @type {{ index: number, length: number }[]} */
  const runs = [];
  for (const m of text.matchAll(/`+/g)) {
    runs.push({ index: m.index, length: m[0].length });
  }
  let out = '';
  let pos = 0;
  for (let i = 0; i < runs.length;) {
    const open = runs[i];
    let j = i + 1;
    while (j < runs.length && runs[j].length !== open.length) j++;
    if (j === runs.length) {
      i++;
      continue;
    }
    const close = runs[j];
    out += text.slice(pos, open.index) + ' ';
    pos = close.index + close.length;
    i = j + 1;
  }
  return out + text.slice(pos);
}

/**
 * Strip fenced code blocks, then inline code spans. Fences go first so a
 * backtick inside a fence can never open a span across the fence.
 *
 * @param {string} text markdown source
 * @returns {string}
 */
export function stripCode(text) {
  return stripCodeSpans(stripFencedCode(text));
}

/** The link regex the checker has always used, run on the stripped text. */
const LINK_RE = /\[[^\]]*\]\(([^)#\s]+?)(?:#[^)]*)?\)/g;

/**
 * Return the href of every markdown link outside fenced code blocks and code
 * spans, in document order (links in indented code are included). Fragments
 * are dropped; the href is otherwise returned verbatim.
 *
 * @param {string} text markdown source
 * @returns {string[]}
 */
export function extractLinks(text) {
  const hrefs = [];
  for (const m of stripCode(text).matchAll(LINK_RE)) hrefs.push(m[1]);
  return hrefs;
}
