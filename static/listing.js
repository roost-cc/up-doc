/** What the layout publishes, shared by docserver.js and `build-static`. */

import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {{ name: string, type: 'dir'|'file', size: number }} Entry
 */

/**
 * Whether `name` is left out of the site: a dot-file or dot-directory.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isHidden(name) {
  return name.startsWith('.');
}

/**
 * Whether a file in `web/` is part of the viewer.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isViewerFile(name) {
  return /\.(js|css|html)$/.test(name);
}

/**
 * The JSON listing of a directory: no hidden entries, directories first, then by name.
 *
 * @param {string} dir
 * @returns {Entry[]}
 */
export function listDir(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => !isHidden(name))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return {
        name,
        type: /** @type {'dir'|'file'} */ (stat.isDirectory() ? 'dir' : 'file'),
        size: stat.size,
      };
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}
