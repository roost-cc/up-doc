/**
 * `up-doc build-static`: turn a documentation root into a tree a static host can serve behind
 * `static/rewrite.cjs`.
 *
 *   /_/*                       the viewer (web/*.js, *.css, *.html)
 *   /_/src/<path>              every content file
 *   /_/ls/<dir>/index.json     one listing per directory (/_/ls/index.json for the root)
 *
 * Every check runs before the first write, so a refused build leaves nothing behind.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { isHidden, isViewerFile, listDir } from './listing.js';

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const USAGE = 'Usage: up-doc build-static --doc-dir <root> --out <dir>';

/**
 * Copy a file, following a symlink, and keep its modification time.
 *
 * @param {string} from
 * @param {string} to
 */
function copy(from, to) {
  fs.copyFileSync(from, to);
  const { atime, mtime } = fs.statSync(from);
  fs.utimesSync(to, atime, mtime);
}

/**
 * `target` with symlinks resolved as far as it exists, so `--out` is compared with `--doc-dir`
 * where it really is.
 *
 * @param {string} target
 * @returns {string}
 */
function realPath(target) {
  if (fs.existsSync(target)) return fs.realpathSync(target);
  const parent = path.dirname(target);
  return parent === target ? target : path.join(realPath(parent), path.basename(target));
}

/**
 * Every directory of the content tree, the root first, as `/`-joined paths relative to it (`''`
 * for the root), with each one's listing. Throws on what the layout has no place for and on a
 * broken symlink.
 *
 * @param {string} docDir
 * @returns {{ dir: string, entries: import('./listing.js').Entry[] }[]}
 */
function scan(docDir) {
  const dirs = [];
  /** @param {string} dir */
  const walk = (dir) => {
    const entries = listDir(path.join(docDir, dir));
    dirs.push({ dir, entries });
    for (const entry of entries) {
      if (entry.type !== 'dir') continue;
      const child = path.posix.join(dir, entry.name);
      if (entry.name === 'index.json') {
        throw new Error(`content directory ${child} needs the path of its parent's listing`);
      }
      walk(child);
    }
  };
  walk('');
  return dirs;
}

/**
 * @param {string} docDir
 * @param {string} out
 * @returns {{ dir: string, entries: import('./listing.js').Entry[] }[]}  The content to write.
 */
function check(docDir, out) {
  if (!fs.existsSync(docDir) || !fs.statSync(docDir).isDirectory()) {
    throw new Error(`--doc-dir ${docDir} is not a directory`);
  }
  const realDoc = realPath(docDir);
  const realOut = realPath(out);
  if (realOut === realDoc || realOut.startsWith(realDoc + path.sep)) {
    throw new Error(`--out ${out} is --doc-dir or inside it`);
  }
  if (fs.existsSync(out) && (!fs.statSync(out).isDirectory() || fs.readdirSync(out).length > 0)) {
    throw new Error(`--out ${out} exists and is not an empty directory`);
  }
  if (fs.readdirSync(docDir).includes('_')) {
    throw new Error(`${path.join(docDir, '_')} takes the /_/ path the site reserves`);
  }
  return scan(docDir);
}

/**
 * @param {string} docDir
 * @param {string} out
 */
function build(docDir, out) {
  const dirs = check(docDir, out);

  const viewer = path.join(out, '_');
  fs.mkdirSync(viewer, { recursive: true });
  for (const name of fs.readdirSync(WEB_DIR).filter(isViewerFile)) {
    copy(path.join(WEB_DIR, name), path.join(viewer, name));
  }

  for (const { dir, entries } of dirs) {
    const src = path.join(viewer, 'src', dir);
    const ls = path.join(viewer, 'ls', dir);
    fs.mkdirSync(src, { recursive: true });
    fs.mkdirSync(ls, { recursive: true });
    fs.writeFileSync(path.join(ls, 'index.json'), JSON.stringify(entries));
    for (const entry of entries) {
      if (entry.type === 'file') copy(path.join(docDir, dir, entry.name), path.join(src, entry.name));
    }
  }
  const files = dirs.reduce((n, { entries }) => n + entries.filter((e) => e.type === 'file').length, 0);
  console.log(`Wrote ${files} files and ${dirs.length} listings to ${out}`);
}

function main() {
  const { values } = parseArgs({
    options: { 'doc-dir': { type: 'string' }, out: { type: 'string' } },
  });
  if (!values['doc-dir'] || !values.out) throw new Error('--doc-dir and --out are required');
  build(path.resolve(values['doc-dir']), path.resolve(values.out));
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}\n${USAGE}`);
  process.exitCode = 1;
}
