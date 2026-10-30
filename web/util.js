/**
 *
 * @param {Object.<string, string>} attributes
 * @param {EventListener} listener
 */
export function addScript(attributes) {
  if (!attributes.src) {
    throw new Error('src is required');
  }
  // Check that the script is not already in the document
  if (document.querySelector(`script[src="${attributes.src}"]`)) return;

  const script = document.createElement('script');
  for (const [key, value] of Object.entries(attributes)) {
    script.setAttribute(key, value);
  }

  const promise = new Promise((resolve, reject) => {
    script.addEventListener('load', resolve);
    script.addEventListener('error', reject);
  });
  document.head.appendChild(script);
  return promise;
}

/**
 * @typedef {{ name: string, type: 'dir'|'file', size: number }} ListingEntry
 */

/**
 * The URL of a content file's raw bytes. These paths are the layout `static/rewrite.cjs` passes
 * through and `build-static` writes.
 *
 * @param {string} path  A root-relative path, percent-encoded as in a URL.
 * @returns {string}
 */
export function srcUrl(path) {
  return `/_/src${path}`;
}

/**
 * The URL of a directory's listing.
 *
 * @param {string} dir  A root-relative directory, percent-encoded as in a URL.
 * @returns {string}
 */
export function listingUrl(dir) {
  return `/_/ls${dir.replace(/\/?$/, '/')}index.json`;
}

/**
 * The file a directory shows: `index.md`, `INDEX.md`, `index.html`, then the same names in any
 * case.
 *
 * @param {ListingEntry[]} entries
 * @returns {string|null}
 */
export function indexName(entries) {
  const files = entries.filter((e) => e?.type === 'file').map((e) => e.name);
  for (const name of ['index.md', 'INDEX.md', 'index.html']) {
    if (files.includes(name)) return name;
  }
  for (const name of ['index.md', 'index.html']) {
    const found = files.find((file) => file.toLowerCase() === name);
    if (found) return found;
  }
  return null;
}

/** @type {Map<string, Promise<ListingEntry[]|null>>} */
const listings = new Map();

/**
 * A directory's entries, from one request per directory per page. The listing answers for any
 * directory that exists, so asking what a directory holds costs no failed request (Chromium logs
 * each one to the console, and a static host may answer 403 for a missing object rather than
 * 404). Null when the listing fails.
 *
 * @param {string} dir  A root-relative directory, percent-encoded as in a URL.
 * @returns {Promise<ListingEntry[]|null>}
 */
export function listing(dir) {
  if (!listings.has(dir)) {
    listings.set(
      dir,
      (async () => {
        try {
          const response = await fetch(listingUrl(dir));
          if (!response.ok) return null;
          const entries = await response.json();
          return Array.isArray(entries) ? entries : null;
        } catch {
          return null;
        }
      })(),
    );
  }
  return listings.get(dir);
}

/**
 * The names of the files at the content root. An empty set when the listing fails.
 *
 * @returns {Promise<Set<string>>}
 */
export async function rootFiles() {
  const entries = (await listing('/')) ?? [];
  return new Set(entries.filter((e) => e?.type === 'file').map((e) => e.name));
}

/**
 * The URL for a root-relative file path, each segment percent-encoded, so a space, `#`, `?` or
 * `%` in a file name stays part of the name. The browser's pathname for it decodes back to
 * `path` exactly.
 *
 * @param {string} path
 * @returns {string}
 */
export function pathHref(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

export function addCSSLink(attributes) {
  if (!attributes.href) {
    throw new Error('href is required');
  }
  const link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  for (const [key, value] of Object.entries(attributes)) {
    link.setAttribute(key, value);
  }

  const promise = new Promise((resolve, reject) => {
    link.addEventListener('load', resolve);
    link.addEventListener('error', reject);
  });
  document.head.appendChild(link);
  return promise;
}

/**
 *
 * @param {string} content
 * @param {string} subcontent
 * @returns {number} The line index of the first occurrence of subcontent in content, or -1 if not found
 */
export function lineIndexOf(content, subcontent) {
  const lines = content.split('\n');
  const sublines = subcontent.split('\n');
  let index = -1;

  let subi = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]; // Don't trim here

    if (line.trim() === sublines[subi].trim()) {
      // humans count from 1, so we add 1 to the index
      if (index === -1) index = i + 1;
      subi++;
      if (subi === sublines.length) return index;
      continue;
    }
    index = -1;
    subi = 0;
  }
  return index;
}
