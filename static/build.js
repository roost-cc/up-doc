/**
 * `up-doc build-static`: turn a documentation root into a tree a static host can serve behind
 * `static/rewrite.cjs`.
 *
 *   /_/*                       the viewer (web/*.js, *.css, *.html)
 *   /_/src/<path>              every content file
 *   /_/ls/<dir>/index.json     one listing per directory (/_/ls/index.json for the root)
 *
 * The checks run before the first write, and `--doc-dir` and `--out` are confirmed unmoved just
 * before the rename, so a refused build leaves nothing behind. The tree is built in a directory
 * beside `--out` and renamed onto it as the last step: `--out` holds the whole tree or nothing, a
 * rename onto a directory that has since filled fails, and each listing is written from the files
 * as copied, so it matches them whatever the source did meanwhile.
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { isViewerFile, listDir } from './listing.js';

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const USAGE = 'Usage: up-doc build-static --doc-dir <root> --out <dir>';

/**
 * Copy a file, following a symlink, and keep its modification time. The time is read first, so a
 * source that changes during the copy looks newer than this copy to the next build.
 *
 * @param {string} from
 * @param {string} to
 * @returns {number}  The size of the copy.
 */
function copy(from, to) {
  const { atime, mtime } = fs.statSync(from);
  fs.copyFileSync(from, to);
  fs.utimesSync(to, atime, mtime);
  return fs.statSync(to).size;
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
 * @param {string} docDir  With symlinks resolved.
 * @param {string} out  With symlinks resolved.
 * @returns {{ dir: string, entries: import('./listing.js').Entry[] }[]}  The content to write.
 */
function check(docDir, out) {
  if (!fs.existsSync(docDir) || !fs.statSync(docDir).isDirectory()) {
    throw new Error(`--doc-dir ${docDir} is not a directory`);
  }
  if (out === docDir || out.startsWith(docDir + path.sep)) {
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
 * Write the whole tree under `viewer`, the directory that becomes `/_/`.
 *
 * @param {{ dir: string, entries: import('./listing.js').Entry[] }[]} dirs
 * @param {string} docDir
 * @param {string} viewer
 */
function write(dirs, docDir, viewer) {
  fs.mkdirSync(viewer, { recursive: true });
  for (const name of fs.readdirSync(WEB_DIR).filter(isViewerFile)) {
    copy(path.join(WEB_DIR, name), path.join(viewer, name));
  }

  for (const { dir, entries } of dirs) {
    const src = path.join(viewer, 'src', dir);
    const ls = path.join(viewer, 'ls', dir);
    fs.mkdirSync(src, { recursive: true });
    fs.mkdirSync(ls, { recursive: true });
    for (const entry of entries) {
      if (entry.type === 'file') {
        entry.size = copy(path.join(docDir, dir, entry.name), path.join(src, entry.name));
      }
    }
    fs.writeFileSync(path.join(ls, 'index.json'), JSON.stringify(entries));
  }
}

/**
 * The topmost directory of `dir` that does not exist yet, if any: what `mkdirSync` is about to
 * make. Worked out first because a `mkdirSync` that fails part way says nothing of what it made.
 *
 * @param {string} dir
 * @returns {string|undefined}
 */
function firstMissing(dir) {
  let first;
  for (let at = dir; !fs.existsSync(at); at = path.dirname(at)) first = at;
  return first;
}

/**
 * Remove what a failed build wrote: its stage, then the parents of `--out` it made, which only go
 * if nothing else has used them. `--out` was never touched, so a failure here is only litter.
 *
 * @param {string} stage
 * @param {string} parent
 * @param {string|undefined} made  The topmost directory the build set out to create.
 */
function discard(stage, parent, made) {
  try {
    // The stage may carry the permissions of --out, which need not let it be emptied
    if (fs.existsSync(stage)) fs.chmodSync(stage, 0o700);
    fs.rmSync(stage, { recursive: true, force: true });
    for (let dir = parent; made && dir.startsWith(made); dir = path.dirname(dir)) {
      if (fs.existsSync(dir)) fs.rmdirSync(dir);
    }
  } catch (error) {
    console.error(`Warning: could not clean up: ${error.message}`);
  }
}

/**
 * @param {string} docDir
 * @param {string} out
 */
function build(docDir, out) {
  // Resolved once: the build reads and writes only the paths that were checked
  const realDoc = realPath(docDir);
  const target = realPath(out);
  const dirs = check(realDoc, target);

  const parent = path.dirname(target);
  const stage = `${target}.tmp-${randomUUID()}`;
  const made = firstMissing(parent);
  try {
    fs.mkdirSync(parent, { recursive: true });
    write(dirs, realDoc, path.join(stage, '_'));
    // The rename replaces an existing --out, whose permissions were someone's choice
    if (fs.existsSync(target)) fs.chmodSync(stage, fs.statSync(target).mode & 0o7777);
    // Node has no rename relative to an open directory, so one system call's gap stays after this
    if (realPath(docDir) !== realDoc || realPath(out) !== target) {
      throw new Error('--doc-dir or --out moved during the build');
    }
    fs.renameSync(stage, target);
  } catch (error) {
    discard(stage, parent, made);
    throw error;
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
