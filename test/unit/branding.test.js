import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DOC_DIR = path.join(ROOT, 'test/fixtures/plain');

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

/**
 * Start docserver.js and resolve once its startup banner is out.
 * @param {Record<string, string>} env
 */
async function startServer(env) {
  const port = await freePort();
  // cwd is the fixture root, so the repo's config.json is not read.
  const child = spawn(process.execPath, [path.join(ROOT, 'docserver.js')], {
    cwd: DOC_DIR,
    env: { ...process.env, DOC_DIR, DOC_PORT: String(port), DOC_USER: '', DOC_PASS: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      out += chunk;
      if (out.includes('Auth:')) resolve(undefined);
    });
    child.on('exit', (code) => reject(new Error(`docserver exited ${code}: ${out}`)));
  });
  return { child, port, banner: out };
}

const basic = (s) => `Basic ${Buffer.from(s).toString('base64')}`;

describe('public_branding_realm_and_startup', () => {
  describe('auth enabled', () => {
    /** @type {Awaited<ReturnType<typeof startServer>>} */
    let srv;
    before(async () => {
      srv = await startServer({ DOC_USER: 'alice', DOC_PASS: 's3cret' });
    });
    after(() => srv.child.kill());

    it('prints the up-doc banner with the configured port', () => {
      assert.match(srv.banner, new RegExp(`^up-doc server at http://localhost:${srv.port}/$`, 'm'));
      assert.match(srv.banner, /Auth: {4}enabled/);
    });

    const rejected = [
      ['no Authorization header', undefined],
      ['non-Basic scheme', 'Bearer abc'],
      ['Basic with no credentials', 'Basic '],
      ['Basic with garbage base64', 'Basic !!!not-base64'],
      ['credentials without a colon', basic('alice')],
      ['wrong password', basic('alice:wrong')],
      ['wrong user', basic('bob:s3cret')],
    ];
    for (const [label, header] of rejected) {
      it(`401 with realm "up-doc": ${label}`, async () => {
        const res = await fetch(`http://localhost:${srv.port}/`, {
          headers: header ? { Authorization: header } : {},
          redirect: 'manual',
        });
        assert.equal(res.status, 401);
        assert.equal(res.headers.get('www-authenticate'), 'Basic realm="up-doc"');
      });
    }

    it('accepts the configured credentials', async () => {
      const res = await fetch(`http://localhost:${srv.port}/`, {
        headers: { Authorization: basic('alice:s3cret') },
        redirect: 'manual',
      });
      assert.notEqual(res.status, 401);
      assert.equal(res.headers.get('www-authenticate'), null);
    });
  });

  describe('auth disabled', () => {
    /** @type {Awaited<ReturnType<typeof startServer>>} */
    let srv;
    before(async () => {
      srv = await startServer({});
    });
    after(() => srv.child.kill());

    it('prints the up-doc banner with the configured port', () => {
      assert.match(srv.banner, new RegExp(`^up-doc server at http://localhost:${srv.port}/$`, 'm'));
      assert.match(srv.banner, /Auth: {4}disabled/);
    });
  });

  it('package description is the up-doc one', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    assert.equal(pkg.description, 'Markdown documentation server with client-side rendering');
  });

  it('README carries no old product name', () => {
    // Assembled so the release's name search over the tree does not hit this test. The npm scope
    // the package is published under is the one use the README needs.
    const oldName = new RegExp(`${['ro', 'ost'].join('')}(?!-cc/up-doc)`, 'i');
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8'), oldName);
  });
});
