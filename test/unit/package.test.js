import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

describe('package.json', () => {
  it('is publishable as @roost-cc/up-doc', () => {
    assert.equal(PKG.name, '@roost-cc/up-doc');
    assert.equal(PKG.private, undefined);
    assert.equal(PKG.license, 'ISC');
    assert.equal(PKG.repository.url, 'git+https://github.com/roost-cc/up-doc.git');
    assert.deepEqual(PKG.bin, { 'up-doc': 'bin/up-doc.js' });
    assert.deepEqual(PKG.exports, { './static/rewrite.cjs': './static/rewrite.cjs' });
  });

  it('package-lock.json carries the name', () => {
    const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
    assert.equal(lock.name, PKG.name);
    assert.equal(lock.packages[''].name, PKG.name);
  });
});

describe('the tarball', () => {
  /** @type {string} */
  let tmp;
  /** @type {string} */
  let tarball;

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'up-doc-pack-'));
    const [{ filename }] = JSON.parse(
      execFileSync(NPM, ['pack', '--json', '--pack-destination', tmp], { cwd: ROOT, encoding: 'utf8' }),
    );
    tarball = path.join(tmp, filename);
  });
  after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('lists only the runtime files', () => {
    const [{ files }] = JSON.parse(execFileSync(NPM, ['pack', '--dry-run', '--json'], { cwd: ROOT, encoding: 'utf8' }));
    const paths = files.map((f) => f.path);
    for (const file of ['docserver.js', 'bin/up-doc.js', 'static/rewrite.cjs', 'static/build.js', 'scripts/check.js']) {
      assert.ok(paths.includes(file), file);
    }
    assert.ok(paths.includes('web/index.html'));
    assert.deepEqual(
      paths.filter((p) => /^(test|\.rrepo|\.git)|config\.json|Dockerfile/.test(p)),
      [],
    );
  });

  it('installs and runs from node_modules/.bin, outside the repo', () => {
    const project = path.join(tmp, 'project');
    const docs = path.join(project, 'docs');
    fs.mkdirSync(docs, { recursive: true });
    fs.writeFileSync(path.join(project, 'package.json'), '{ "private": true }');
    fs.writeFileSync(path.join(docs, 'index.md'), '# Home\n\n[Other](other.md)\n');
    fs.writeFileSync(path.join(docs, 'other.md'), '# Other\n');
    execFileSync(NPM, ['install', '--no-audit', '--no-fund', '--prefer-offline', tarball], {
      cwd: project,
      stdio: 'pipe',
    });
    const bin = path.join(project, 'node_modules/.bin/up-doc');
    const env = { ...process.env };
    delete env.DOC_DIR;
    delete env.ROOST_DIR;

    const build = spawnSync(bin, ['build-static', '--doc-dir', 'docs', '--out', 'site'], {
      cwd: project,
      env,
      encoding: 'utf8',
    });
    assert.equal(build.status, 0, build.stderr);
    assert.ok(fs.existsSync(path.join(project, 'site/_/src/index.md')));
    assert.ok(fs.existsSync(path.join(project, 'site/_/ls/index.json')));

    const check = spawnSync(bin, ['check', '--doc-dir', 'docs'], { cwd: project, env, encoding: 'utf8' });
    assert.equal(check.status, 0, check.stdout + check.stderr);
    assert.match(check.stdout, /Crawled 2 pages/);

    const rewrite = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { rewriteUri } from '@roost-cc/up-doc/static/rewrite.cjs'; console.log(rewriteUri('/a.png'));`,
      ],
      { cwd: project, env, encoding: 'utf8' },
    );
    assert.equal(rewrite.stdout.trim(), '/_/src/a.png', rewrite.stderr);
  });
});
