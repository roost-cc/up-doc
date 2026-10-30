import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { handler, rewriteUri } from '../../static/rewrite.cjs';
import { indexName, listingUrl, srcUrl } from '../../web/util.js';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../static/rewrite.cjs');

describe('rewriteUri', () => {
  const cases = [
    ['/_/index.js', '/_/index.js', '/_/ paths pass through'],
    ['/_/', '/_/', '/_/ itself passes through'],
    ['/_/src/a.png', '/_/src/a.png', 'raw content passes through'],
    ['/_/ls/index.json', '/_/ls/index.json', 'a listing passes through'],
    ['/', '/_/index.html', 'the root'],
    ['/guide/', '/_/index.html', 'a trailing slash'],
    ['/guide/a.md', '/_/index.html', 'markdown'],
    ['/api/openapi.json', '/_/index.html', 'JSON'],
    ['/guide', '/_/index.html', 'no dot in the last segment'],
    ['/v1.2/guide', '/_/index.html', 'a dot in an earlier segment only'],
    ['/logo.png', '/_/src/logo.png', 'any other file'],
    ['/v1.2', '/_/src/v1.2', 'a dotted directory without a slash'],
    ['/a%20b/c%23d.png', '/_/src/a%20b/c%23d.png', 'an encoded path stays encoded'],
    ['/a%20b.md', '/_/index.html', 'an encoded markdown path'],
    ['/a%2Eb', '/_/index.html', 'an encoded dot is not a dot'],
  ];
  for (const [uri, expected, label] of cases) {
    it(`${label}: ${uri}`, () => assert.equal(rewriteUri(uri), expected));
  }
});

describe('handler', () => {
  it('rewrites event.request.uri and returns the request', () => {
    const request = { uri: '/logo.png', method: 'GET' };
    assert.deepEqual(handler({ request }), { uri: '/_/src/logo.png', method: 'GET' });
  });
});

describe('the file', () => {
  const source = fs.readFileSync(FILE, 'utf8');

  it('is a plain script a CloudFront Function can run', () => {
    assert.doesNotMatch(source, /^\s*(import|export)\s/m);
    assert.doesNotMatch(source, /\brequire\(/);
  });

  it('ends in the Node guard', () => {
    assert.ok(
      source.trimEnd().endsWith(`if (typeof module !== 'undefined') module.exports = { rewriteUri, handler };`),
    );
  });

  it('runs with no module in scope', () => {
    const run = new Function(`${source}\nreturn rewriteUri('/a.png');`);
    assert.equal(run(), '/_/src/a.png');
  });
});

describe('the viewer paths match the rewrite', () => {
  it('srcUrl is the path a raw file rewrites to', () => {
    assert.equal(srcUrl('/a%20b/c.png'), rewriteUri('/a%20b/c.png'));
  });

  it('srcUrl and listingUrl pass through unchanged', () => {
    for (const uri of [srcUrl('/a.md'), srcUrl('/LICENSE'), listingUrl('/'), listingUrl('/a/b/')]) {
      assert.equal(rewriteUri(uri), uri);
    }
  });

  it('listingUrl is the layout path', () => {
    assert.equal(listingUrl('/'), '/_/ls/index.json');
    assert.equal(listingUrl('/a%20b/'), '/_/ls/a%20b/index.json');
    assert.equal(listingUrl('/a'), '/_/ls/a/index.json');
  });
});

describe('indexName', () => {
  const files = (...names) => names.map((name) => ({ name, type: 'file', size: 1 }));

  const cases = [
    [['a.md', 'index.md'], 'index.md'],
    [['INDEX.md', 'index.html', 'index.md'], 'index.md'],
    [['INDEX.md', 'index.html'], 'INDEX.md'],
    [['Index.md', 'index.html'], 'index.html'],
    [['Index.html', 'Index.md'], 'Index.md'],
    [['INDEX.HTML'], 'INDEX.HTML'],
    [['reindex.md', 'index.md.txt'], null],
    [[], null],
  ];
  for (const [names, expected] of cases) {
    it(`[${names}] → ${expected}`, () => assert.equal(indexName(files(...names)), expected));
  }

  it('a directory is no index file', () => {
    assert.equal(indexName([{ name: 'index.md', type: 'dir', size: 1 }]), null);
  });
});
