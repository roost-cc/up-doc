import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** @returns {Promise<number>} a port that was free a moment ago */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, () => {
      const { port } = /** @type {net.AddressInfo} */ (srv.address());
      srv.close(() => resolve(port));
    });
  });
}

describe('docserver routes', () => {
  /** @type {string} */
  let tmp;
  /** @type {import('node:child_process').ChildProcess} */
  let child;
  /** @type {number} */
  let port;

  before(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'up-doc-routes-'));
    const doc = path.join(tmp, 'docs');
    fs.mkdirSync(path.join(doc, 'dir'), { recursive: true });
    fs.writeFileSync(path.join(doc, 'index.md'), '# Home');
    fs.writeFileSync(path.join(doc, 'a b#1%.md'), '# Odd');
    fs.writeFileSync(path.join(doc, 'dir', 'index.md'), '# Dir');
    fs.writeFileSync(path.join(doc, '.env'), 'hidden');
    fs.writeFileSync(path.join(tmp, 'secret.md'), 'outside');
    fs.mkdirSync(path.join(tmp, 'docs-sibling'));
    fs.writeFileSync(path.join(tmp, 'docs-sibling', 'secret.md'), 'outside');

    port = await freePort();
    child = spawn(process.execPath, [path.join(ROOT, 'docserver.js')], {
      cwd: tmp,
      env: { ...process.env, DOC_DIR: doc, DOC_PORT: String(port), DOC_USER: '', DOC_PASS: '' },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    await new Promise((resolve) => {
      child.stdout.on('data', (chunk) => {
        if (String(chunk).includes('Auth:')) resolve(undefined);
      });
    });
  });
  after(() => {
    child.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  /** @param {string} pathname */
  const get = (pathname) => fetch(`http://localhost:${port}${pathname}`);

  const notFound = [
    ['/_/', '/_/ itself'],
    ['/_/README.md', 'a file in web/ that is not part of the viewer'],
    ['/_/src/dir', 'a directory under /_/src/'],
    ['/_/src/dir/', 'a directory with a slash under /_/src/'],
    ['/_/src/missing.md', 'a missing file'],
    ['/_/src/.env', 'a dot-file'],
    ['/_/ls/missing/index.json', 'a missing directory'],
    ['/_/ls/index.md/index.json', 'a listing of a file'],
    ['/_/ls/dir/', 'a listing path without index.json'],
    ['/_/ls/dir', 'a listing path that names no listing'],
    ['/_/src/..%2fsecret.md', 'encoded traversal out of the content root'],
    ['/_/src/%2e%2e%2fsecret.md', 'encoded dots out of the content root'],
    ['/_/src/..%2fdocs-sibling%2fsecret.md', 'encoded traversal into a sibling'],
    ['/_/ls/..%2f/index.json', 'encoded traversal in a listing'],
    ['/_/..%2fdocserver.js', 'encoded traversal out of web/'],
    ['/_/src/100%.md', 'malformed percent-encoding under /_/src/'],
    ['/_/ls/%ZZ/index.json', 'malformed percent-encoding under /_/ls/'],
    ['/100%.png', 'malformed percent-encoding on a raw path'],
  ];
  for (const [pathname, label] of notFound) {
    it(`404: ${label}`, async () => assert.equal((await get(pathname)).status, 404, pathname));
  }

  it('serves exactly the file under /_/src/', async () => {
    const res = await get('/_/src/dir/index.md');
    assert.equal(res.status, 200);
    assert.equal(await res.text(), '# Dir');
    assert.ok(res.headers.get('last-modified'));
  });

  it('decodes an encoded name once', async () => {
    const res = await get('/_/src/a%20b%231%25.md');
    assert.equal(res.status, 200);
    assert.equal(await res.text(), '# Odd');
  });

  it('serves listings, without dot-files', async () => {
    const root = await (await get('/_/ls/index.json')).json();
    assert.deepEqual(
      root.map((e) => [e.name, e.type]),
      [
        ['dir', 'dir'],
        ['a b#1%.md', 'file'],
        ['index.md', 'file'],
      ],
    );
    const dir = await (await get('/_/ls/dir/index.json')).json();
    assert.deepEqual(
      dir.map((e) => e.name),
      ['index.md'],
    );
  });

  it('answers the viewer for what the rewrite sends there, with no stat', async () => {
    const shell = await (await get('/_/index.html')).text();
    for (const pathname of [
      '/',
      '/dir/',
      '/dir',
      '/missing',
      '/missing.md',
      '/missing.json',
      '/src:/index.md',
      '/ls:/',
    ]) {
      const res = await get(pathname);
      assert.equal(res.status, 200, pathname);
      assert.equal(await res.text(), shell, pathname);
    }
  });
});
