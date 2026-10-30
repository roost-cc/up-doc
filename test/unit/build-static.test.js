import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BIN = path.join(ROOT, 'bin/up-doc.js');

/** @param {string[]} args */
function upDoc(...args) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });
}

/**
 * Write `files` (path → content) under a new directory.
 *
 * @param {string} parent
 * @param {Record<string, string>} files
 * @returns {string}
 */
function tree(parent, files) {
  const root = fs.mkdtempSync(path.join(parent, 'root-'));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
}

describe('build-static', () => {
  /** @type {string} */
  let tmp;
  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'up-doc-build-'));
  });
  after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  /** @param {string} out */
  const assertRefused = (args, out) => {
    const result = upDoc('build-static', ...args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /^Error: /);
    if (out) assert.equal(fs.existsSync(path.join(out, '_')), false, 'nothing is written');
  };

  describe('the tree', () => {
    /** @type {string} */
    let doc;
    /** @type {string} */
    let out;
    const mtime = new Date('2020-02-03T04:05:06Z');

    before(() => {
      doc = tree(tmp, {
        'index.md': '# Home',
        'a b#1%.md': '# Odd',
        'guide/intro.md': '# Intro',
        'guide/deep/x.png': 'png',
        'guide/index.json': '{}',
        'guide/.draft.md': 'hidden',
        '.env': 'hidden',
        '.git/config': 'hidden',
        'guide/.cache/x': 'hidden',
      });
      fs.mkdirSync(path.join(doc, 'empty'));
      fs.symlinkSync(path.join(doc, 'index.md'), path.join(doc, 'link.md'));
      fs.utimesSync(path.join(doc, 'guide/intro.md'), mtime, mtime);
      out = path.join(tmp, 'out');
      const result = upDoc('build-static', '--doc-dir', doc, '--out', out);
      assert.equal(result.status, 0, result.stderr);
    });

    /** @param {string} file */
    const has = (file) => fs.existsSync(path.join(out, file));
    /** @param {string} file */
    const listing = (file) => JSON.parse(fs.readFileSync(path.join(out, '_/ls', file), 'utf8'));

    it('holds the viewer under /_/', () => {
      for (const file of ['index.html', 'index.js', 'index.css', 'util.js']) assert.ok(has(`_/${file}`), file);
      assert.equal(has('_/README.md'), false);
    });

    it('holds every content file under /_/src/', () => {
      for (const file of ['index.md', 'a b#1%.md', 'guide/intro.md', 'guide/deep/x.png', 'guide/index.json']) {
        assert.ok(has(`_/src/${file}`), file);
      }
    });

    it('writes one listing per directory, as /_/ls/ returns it', () => {
      assert.deepEqual(listing('index.json'), [
        { name: 'empty', type: 'dir', size: fs.statSync(path.join(doc, 'empty')).size },
        { name: 'guide', type: 'dir', size: fs.statSync(path.join(doc, 'guide')).size },
        { name: 'a b#1%.md', type: 'file', size: 5 },
        { name: 'index.md', type: 'file', size: 6 },
        { name: 'link.md', type: 'file', size: 6 },
      ]);
      assert.deepEqual(
        listing('guide/index.json').map((e) => e.name),
        ['deep', 'index.json', 'intro.md'],
      );
      assert.deepEqual(listing('guide/deep/index.json'), [{ name: 'x.png', type: 'file', size: 3 }]);
      assert.deepEqual(listing('empty/index.json'), []);
    });

    it('skips dot-files and dot-directories at every depth', () => {
      for (const file of ['.env', '.git', 'guide/.draft.md', 'guide/.cache']) {
        assert.equal(has(`_/src/${file}`), false, file);
        assert.equal(has(`_/ls/${file}`), false, file);
      }
    });

    it('keeps modification times', () => {
      assert.equal(fs.statSync(path.join(out, '_/src/guide/intro.md')).mtime.getTime(), mtime.getTime());
      assert.equal(
        fs.statSync(path.join(out, '_/index.js')).mtime.getTime(),
        fs.statSync(path.join(ROOT, 'web/index.js')).mtime.getTime(),
      );
    });

    it('copies a symlink as the file it points to', () => {
      assert.equal(fs.lstatSync(path.join(out, '_/src/link.md')).isSymbolicLink(), false);
    });
  });

  it('builds into an existing empty --out', () => {
    const doc = tree(tmp, { 'index.md': '# Home' });
    const out = fs.mkdtempSync(path.join(tmp, 'empty-out-'));
    assert.equal(upDoc('build-static', '--doc-dir', doc, '--out', out).status, 0);
    assert.ok(fs.existsSync(path.join(out, '_/src/index.md')));
  });

  describe('refuses', () => {
    it('a missing flag', () => {
      const doc = tree(tmp, { 'index.md': '# Home' });
      assertRefused(['--doc-dir', doc]);
      assertRefused(['--out', path.join(tmp, 'never')]);
      assert.equal(fs.existsSync(path.join(tmp, 'never')), false);
    });

    it('a --doc-dir that is not a directory', () => {
      const out = path.join(tmp, 'no-doc');
      assertRefused(['--doc-dir', path.join(tmp, 'absent'), '--out', out]);
      assert.equal(fs.existsSync(out), false);
    });

    it('an --out that is not empty', () => {
      const doc = tree(tmp, { 'index.md': '# Home' });
      const out = tree(tmp, { 'old.txt': 'keep' });
      assertRefused(['--doc-dir', doc, '--out', out], out);
      assert.deepEqual(fs.readdirSync(out), ['old.txt']);
    });

    it('an --out that is a file', () => {
      const doc = tree(tmp, { 'index.md': '# Home' });
      const out = path.join(tree(tmp, { file: 'x' }), 'file');
      assertRefused(['--doc-dir', doc, '--out', out]);
    });

    it('an --out that is --doc-dir', () => {
      const doc = fs.mkdtempSync(path.join(tmp, 'same-'));
      assertRefused(['--doc-dir', doc, '--out', doc], doc);
    });

    it('an --out inside --doc-dir', () => {
      const doc = tree(tmp, { 'index.md': '# Home' });
      const out = path.join(doc, 'site', 'public');
      assertRefused(['--doc-dir', doc, '--out', out]);
      assert.equal(fs.existsSync(path.join(doc, 'site')), false);
    });

    it('an --out inside --doc-dir through a symlink', () => {
      const doc = tree(tmp, { 'index.md': '# Home' });
      const link = path.join(tmp, `link-${path.basename(doc)}`);
      fs.symlinkSync(doc, link);
      assertRefused(['--doc-dir', doc, '--out', path.join(link, 'out')]);
      assert.equal(fs.existsSync(path.join(doc, 'out')), false);
    });

    it('a top-level _ entry, file or directory', () => {
      for (const entry of ['_', '_/x.md']) {
        const doc = tree(tmp, { [entry]: 'x' });
        const out = path.join(tmp, `reserved-${path.basename(doc)}`);
        assertRefused(['--doc-dir', doc, '--out', out]);
        assert.equal(fs.existsSync(out), false);
      }
    });

    it('a content directory named index.json, at any depth', () => {
      for (const entry of ['index.json/x.md', 'a/b/index.json/x.md']) {
        const doc = tree(tmp, { [entry]: 'x' });
        const out = path.join(tmp, `listing-${path.basename(doc)}`);
        assertRefused(['--doc-dir', doc, '--out', out]);
        assert.equal(fs.existsSync(out), false);
      }
    });

    it('a broken symlink, loudly and writing nothing', () => {
      const doc = tree(tmp, { 'index.md': '# Home' });
      fs.symlinkSync(path.join(doc, 'absent.md'), path.join(doc, 'broken.md'));
      const out = path.join(tmp, `broken-${path.basename(doc)}`);
      assertRefused(['--doc-dir', doc, '--out', out]);
      assert.equal(fs.existsSync(out), false);
    });

    it('a symlink cycle, writing nothing', () => {
      const doc = tree(tmp, { 'index.md': '# Home' });
      fs.symlinkSync(doc, path.join(doc, 'loop'));
      const out = path.join(tmp, `cycle-${path.basename(doc)}`);
      assertRefused(['--doc-dir', doc, '--out', out]);
      assert.equal(fs.existsSync(out), false);
    });
  });

  describe('a copy that fails part way', { skip: process.getuid?.() === 0 && 'root reads anything' }, () => {
    /** @returns {string} a root with a file that passes every check and cannot be read */
    const unreadable = () => {
      const doc = tree(tmp, { 'index.md': '# Home', 'z/last.md': 'x' });
      fs.chmodSync(path.join(doc, 'z/last.md'), 0);
      return doc;
    };

    it('removes an --out it created, parents included, so the build can run again', () => {
      const doc = unreadable();
      const parent = path.join(tmp, `partial-${path.basename(doc)}`);
      const out = path.join(parent, 'site');
      assertRefused(['--doc-dir', doc, '--out', out]);
      assert.equal(fs.existsSync(parent), false);

      fs.chmodSync(path.join(doc, 'z/last.md'), 0o644);
      assert.equal(upDoc('build-static', '--doc-dir', doc, '--out', out).status, 0);
    });

    it('leaves an existing empty --out in place and empty', () => {
      const out = fs.mkdtempSync(path.join(tmp, 'partial-empty-'));
      assertRefused(['--doc-dir', unreadable(), '--out', out], out);
      assert.deepEqual(fs.readdirSync(out), []);
    });
  });
});

describe('the up-doc bin', () => {
  it('prints usage and fails on anything else', () => {
    for (const arg of ['serve', 'undefined', '--help', 'toString']) {
      const result = upDoc(arg);
      assert.equal(result.status, 1, arg);
      assert.match(result.stderr, /^Usage:/, arg);
    }
  });

  it('check takes the link checker flags and reports its exit code', () => {
    const result = upDoc('check', '--doc-dir', path.join(ROOT, 'test/fixtures/site'));
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /All links OK/);
  });
});
