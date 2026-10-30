import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BIN = path.join(ROOT, 'bin/up-doc.js');
const FS_FAULT = path.join(ROOT, 'test/fs-fault.js');

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

  describe('build_static_atomic_destination_and_snapshot', () => {
    /**
     * Run a build with `faults` (see test/fs-fault.js) injected into it.
     *
     * @param {string} doc
     * @param {string} out
     * @param {object[]} faults
     */
    const faulted = (doc, out, faults) =>
      spawnSync(
        process.execPath,
        ['--import', pathToFileURL(FS_FAULT).href, BIN, 'build-static', '--doc-dir', doc, '--out', out],
        { encoding: 'utf8', env: { ...process.env, FS_FAULT: JSON.stringify(faults) } },
      );

    /** Every listing under `out` names exactly the files beside it, at their real sizes. */
    const assertCoherent = (out) => {
      /** @param {string} dir */
      const walk = (dir) => {
        const src = path.join(out, '_/src', dir);
        const listing = JSON.parse(fs.readFileSync(path.join(out, '_/ls', dir, 'index.json'), 'utf8'));
        assert.deepEqual(listing.map((e) => e.name).sort(), fs.readdirSync(src).sort(), dir);
        for (const entry of listing) {
          if (entry.type === 'dir') walk(path.join(dir, entry.name));
          else assert.equal(entry.size, fs.statSync(path.join(src, entry.name)).size, entry.name);
        }
      };
      walk('');
    };

    /** Nothing but `expected` beside `out`, so no stage survives. */
    const assertNoStage = (out, expected) => {
      assert.deepEqual(fs.readdirSync(path.dirname(out)).sort(), expected);
    };

    /** Each step of a build, failing there, with the tree it was writing left half done. */
    const STEPS = [
      ['making the parent', { op: 'mkdirSync', match: 'parent-', action: 'fail' }],
      ['making the stage', { op: 'mkdirSync', match: '.tmp-', action: 'fail', after: true }],
      ['a nested directory', { op: 'mkdirSync', match: '_/ls/guide', action: 'fail', after: true }],
      ['a viewer read', { op: 'readdirSync', match: '/web', action: 'fail' }],
      ['a viewer copy', { op: 'copyFileSync', match: '/web/index.js', action: 'fail', after: true }],
      ['a content copy', { op: 'copyFileSync', match: 'guide/intro.md', action: 'fail', after: true }],
      ['a timestamp', { op: 'utimesSync', match: 'guide/intro.md', action: 'fail' }],
      ['a listing', { op: 'writeFileSync', match: '_/ls/guide/index.json', action: 'fail', after: true }],
      ['the rename', { op: 'renameSync', match: '.tmp-', action: 'fail' }],
      ['a source file vanishing', { op: 'copyFileSync', match: 'guide/intro.md', action: 'remove' }],
    ];

    for (const [step, fault] of STEPS) {
      it(`a failure at ${step} leaves nothing and the build can run again`, () => {
        const doc = tree(tmp, { 'index.md': '# Home', 'guide/intro.md': 'x' });
        const parent = fs.mkdtempSync(path.join(tmp, 'atomic-')) + '/parent-a/b';
        const out = path.join(parent, 'site');
        const result = faulted(doc, out, [fault]);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /^Error: /);
        assert.equal(fs.existsSync(path.dirname(path.dirname(parent)) + '/parent-a'), false);

        fs.writeFileSync(path.join(doc, 'guide/intro.md'), 'x');
        assert.equal(upDoc('build-static', '--doc-dir', doc, '--out', out).status, 0);
        assertCoherent(out);
        assertNoStage(out, ['site']);
      });

      it(`a failure at ${step} leaves an existing empty --out empty`, () => {
        const doc = tree(tmp, { 'index.md': '# Home', 'guide/intro.md': 'x' });
        const parent = fs.mkdtempSync(path.join(tmp, 'atomic-parent-'));
        const out = path.join(parent, 'site');
        fs.mkdirSync(out);
        assert.notEqual(faulted(doc, out, [fault]).status, 0);
        assert.deepEqual(fs.readdirSync(out), []);
        assertNoStage(out, ['site']);
      });
    }

    it('a cleanup that fails too keeps the real error, an untouched --out, and a working retry', () => {
      const doc = tree(tmp, { 'index.md': '# Home' });
      const out = path.join(fs.mkdtempSync(path.join(tmp, 'atomic-')), 'site');
      const result = faulted(doc, out, [
        { op: 'copyFileSync', match: 'index.md', action: 'fail', after: true },
        { op: 'rmSync', match: '.tmp-', action: 'fail' },
      ]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Warning: could not clean up/);
      assert.match(result.stderr, /Error: injected copyFileSync failure/);
      assert.equal(fs.existsSync(out), false);

      assert.equal(upDoc('build-static', '--doc-dir', doc, '--out', out).status, 0);
      assertCoherent(out);
    });

    for (const existing of [false, true]) {
      it(`two builds racing for ${existing ? 'an empty' : 'a new'} --out: one wins whole, one fails`, () => {
        const first = tree(tmp, { 'a.md': 'A' });
        const second = tree(tmp, { 'b.md': 'B' });
        const out = path.join(fs.mkdtempSync(path.join(tmp, 'atomic-')), 'site');
        if (existing) fs.mkdirSync(out);
        const result = faulted(first, out, [
          {
            op: 'renameSync',
            match: '.tmp-',
            action: 'run',
            argv: [BIN, 'build-static', '--doc-dir', second, '--out', out],
          },
        ]);
        assert.notEqual(result.status, 0, 'the loser fails');
        assert.deepEqual(fs.readdirSync(path.join(out, '_/src')), ['b.md']);
        assertCoherent(out);
        assertNoStage(out, ['site']);
      });
    }

    const CHANGES = [
      ['a file growing', { op: 'copyFileSync', match: 'a.md', action: 'append' }],
      ['a file changing mid-tree', { op: 'copyFileSync', match: 'guide/b.md', action: 'append' }],
    ];
    for (const [change, fault] of CHANGES) {
      it(`${change} after the scan still gives listings that match the copies`, () => {
        const doc = tree(tmp, { 'a.md': 'A', 'guide/b.md': 'B' });
        const out = path.join(fs.mkdtempSync(path.join(tmp, 'atomic-')), 'site');
        assert.equal(faulted(doc, out, [fault]).status, 0);
        assertCoherent(out);
      });
    }

    it('a file appearing after the scan is neither listed nor copied', () => {
      const doc = tree(tmp, { 'a.md': 'A' });
      const out = path.join(fs.mkdtempSync(path.join(tmp, 'atomic-')), 'site');
      const fault = { op: 'copyFileSync', match: 'a.md', action: 'create', file: path.join(doc, 'late.md') };
      assert.equal(faulted(doc, out, [fault]).status, 0);
      assertCoherent(out);
      assert.equal(fs.existsSync(path.join(out, '_/src/late.md')), false);
    });

    it('a new file in --out during the build makes it fail and is kept', () => {
      const doc = tree(tmp, { 'a.md': 'A' });
      const out = fs.mkdtempSync(path.join(tmp, 'atomic-out-'));
      const late = path.join(out, 'late.txt');
      const fault = { op: 'renameSync', match: '.tmp-', action: 'create', file: late };
      assert.notEqual(faulted(doc, out, [fault]).status, 0);
      assert.deepEqual(fs.readdirSync(out), ['late.txt']);
    });

    it('gives the tree the ordinary permissions, not a private temporary directory’s', () => {
      const doc = tree(tmp, { 'a.md': 'A' });
      const out = path.join(fs.mkdtempSync(path.join(tmp, 'atomic-')), 'site');
      assert.equal(upDoc('build-static', '--doc-dir', doc, '--out', out).status, 0);
      const mode = fs.statSync(out).mode & 0o777;
      assert.equal(mode, 0o777 & ~process.umask());
    });

    it('keeps the permissions of an existing empty --out', () => {
      const doc = tree(tmp, { 'a.md': 'A' });
      const out = path.join(fs.mkdtempSync(path.join(tmp, 'atomic-')), 'site');
      fs.mkdirSync(out, { mode: 0o700 });
      assert.equal(upDoc('build-static', '--doc-dir', doc, '--out', out).status, 0);
      assert.equal(fs.statSync(out).mode & 0o777, 0o700);
    });

    it('a file changing during its copy keeps the time from before the change', () => {
      const doc = tree(tmp, { 'a.md': 'A' });
      fs.utimesSync(path.join(doc, 'a.md'), 1000, 1000);
      const out = path.join(fs.mkdtempSync(path.join(tmp, 'atomic-')), 'site');
      const fault = { op: 'copyFileSync', match: 'a.md', action: 'append' };
      assert.equal(faulted(doc, out, [fault]).status, 0);
      assert.equal(fs.statSync(path.join(out, '_/src/a.md')).mtimeMs, 1000000);
    });

    it('builds through an --out that is a symlink to an empty directory', () => {
      const doc = tree(tmp, { 'a.md': 'A' });
      const real = fs.mkdtempSync(path.join(tmp, 'atomic-real-'));
      const link = path.join(fs.mkdtempSync(path.join(tmp, 'atomic-')), 'site');
      fs.symlinkSync(real, link);
      const result = upDoc('build-static', '--doc-dir', doc, '--out', link);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(fs.lstatSync(link).isSymbolicLink());
      assertCoherent(real);
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
