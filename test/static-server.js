/**
 * Test-only stand-in for a static host: S3 behind CloudFront and `static/rewrite.cjs`. Builds one
 * fixture root and serves the tree with no route but `rewriteUri`. A missing object is a 403, as
 * S3 behind Origin Access Control answers without `s3:ListBucket`, so no test can pass through a
 * 404.
 *
 * Usage: node test/static-server.js <fixture> <port>
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mime from 'mime-types';

import { rewriteUri } from '../static/rewrite.cjs';

const [fixture, port] = process.argv.slice(2);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(ROOT, 'test-results', 'static', fixture);

fs.rmSync(out, { recursive: true, force: true });
execFileSync(process.execPath, [
  path.join(ROOT, 'bin', 'up-doc.js'),
  'build-static',
  '--doc-dir',
  path.join(ROOT, 'test', 'fixtures', fixture),
  '--out',
  out,
]);

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    const file = path.join(out, decodeURIComponent(rewriteUri(pathname)));
    if (!file.startsWith(out + path.sep) || !fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
      res.writeHead(403, { 'Content-Type': 'application/xml' });
      res.end('<Error><Code>AccessDenied</Code></Error>');
      return;
    }
    const content = fs.readFileSync(file);
    res.writeHead(200, {
      'Content-Type': mime.lookup(file) || 'application/octet-stream',
      'Last-Modified': fs.statSync(file).mtime.toUTCString(),
    });
    res.end(content);
  })
  .listen(Number(port));
