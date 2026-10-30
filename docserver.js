#!/usr/bin/env node

/**
 * up-doc — markdown documentation server.
 *
 * Serves markdown files via a client-side SPA renderer. The SPA lives in the
 * server's own `web/` directory and is served at `/_/`. Content (markdown, HTML,
 * images, etc.) is served from the configured `directory` root.
 *
 * Every request goes through `rewriteUri` (static/rewrite.cjs), the rule a static
 * host applies to the tree `up-doc build-static` writes, so both answer alike:
 *   /_/src/<path>           → raw content: exactly that file, a directory is a 404
 *   /_/ls/<dir>/index.json  → the directory's listing (/_/ls/index.json for the root)
 *   /_/*                    → the server's web/ directory (the SPA)
 *   *.md, *.json            → /_/index.html (SPA renders client-side)
 *   a trailing / or no dot  → /_/index.html (SPA resolves the path from a listing)
 *   anything else           → /_/src<path>
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mime from 'mime-types';

import { isHidden, isViewerFile, listDir } from './static/listing.js';
import { rewriteUri } from './static/rewrite.cjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let fileConfig = {};
try {
  fileConfig = JSON.parse(fs.readFileSync(path.resolve('config.json'), 'utf8'));
} catch {
  // No config file — use env/defaults only
}

const PORT = parseInt(process.env.DOC_PORT, 10) || fileConfig.port || 8080;
const DOC_DIR = path.resolve(process.env.DOC_DIR || fileConfig.directory || '.');
const WEB_DIR = path.resolve(__dirname, 'web');
const AUTH_USER = process.env.DOC_USER || null;
const AUTH_PASS = process.env.DOC_PASS || null;

/**
 * @param {string} rootDir
 * @param {string} filePath
 * @returns {boolean}
 */
function isInside(rootDir, filePath) {
  return filePath === rootDir || filePath.startsWith(rootDir + path.sep);
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function getMimeType(filePath) {
  return mime.lookup(filePath) || 'application/octet-stream';
}

/**
 * @param {http.ServerResponse} res
 */
function sendNotFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 - File not found');
}

/**
 * @param {http.ServerResponse} res
 * @param {Error} error
 * @param {string} requestPath
 */
function sendError(res, error, requestPath) {
  console.error(`Error: ${error.message} for request path: ${requestPath}`);
  res.writeHead(500, { 'Content-Type': 'text/plain' });
  res.end('500 - Server error');
}

/**
 * @param {http.ServerResponse} res
 */
function sendUnauthorized(res) {
  res.writeHead(401, {
    'Content-Type': 'text/plain',
    'WWW-Authenticate': 'Basic realm="up-doc"',
  });
  res.end('401 - Unauthorized');
}

/**
 * Check HTTP Basic Auth against configured credentials.
 * Returns true if auth is disabled or credentials match.
 * @param {http.IncomingMessage} req
 * @returns {boolean}
 */
function checkAuth(req) {
  if (!AUTH_USER || !AUTH_PASS) return true;
  const header = req.headers.authorization;
  if (!header?.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString();
  const [user, pass] = decoded.split(':');
  return user === AUTH_USER && pass === AUTH_PASS;
}

/**
 * Serve a file from a given root directory. Anything but a file there is a 404.
 * @param {http.ServerResponse} res
 * @param {string} rootDir
 * @param {string} relativePath
 * @param {http.OutgoingHttpHeaders} [headers]
 */
function serveFile(res, rootDir, relativePath, headers = {}) {
  const filePath = path.normalize(path.join(rootDir, relativePath));

  // Prevent path traversal
  if (!isInside(rootDir, filePath)) return sendNotFound(res);
  if (!fs.existsSync(filePath)) return sendNotFound(res);

  const stats = fs.statSync(filePath);
  if (stats.isDirectory()) return sendNotFound(res);

  try {
    const content = fs.readFileSync(filePath);
    const mimeType = getMimeType(filePath);
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': content.length,
      'Last-Modified': stats.mtime.toUTCString(),
      ...headers,
    });
    res.end(content);
  } catch (error) {
    sendError(res, error, filePath);
  }
}

/**
 * Serve `/_/ls/<dir>/index.json`, the listing `build-static` writes at that path.
 * @param {http.ServerResponse} res
 * @param {string} relativePath  The path after `/_/ls/`.
 */
function serveListing(res, relativePath) {
  const match = /^(.*\/)?index\.json$/.exec(relativePath);
  if (!match) return sendNotFound(res);
  const dirPath = path.normalize(path.join(DOC_DIR, match[1] ?? ''));

  if (!isInside(DOC_DIR, dirPath)) return sendNotFound(res);
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return sendNotFound(res);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(listDir(dirPath)));
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function handleRequest(req, res) {
  try {
    if (!checkAuth(req)) return sendUnauthorized(res);

    const { pathname } = new URL(req.url, 'http://localhost');
    const objectPath = decodeURIComponent(rewriteUri(pathname));
    console.log(`${req.method} ${pathname} → ${objectPath}`);

    // What build-static leaves out of the tree is not served either
    if (objectPath.split('/').some(isHidden)) return sendNotFound(res);

    if (objectPath.startsWith('/_/src/')) return serveFile(res, DOC_DIR, objectPath.slice(7));
    if (objectPath.startsWith('/_/ls/')) return serveListing(res, objectPath.slice(6));
    if (!isViewerFile(objectPath)) return sendNotFound(res);
    return serveFile(res, WEB_DIR, objectPath.slice(3), { 'Cache-Control': 'no-cache' });
  } catch (error) {
    // A path that is not valid percent-encoding names no object
    if (error instanceof URIError) return sendNotFound(res);
    sendError(res, error, req.url);
  }
}

function main() {
  if (!fs.existsSync(DOC_DIR)) {
    console.error(`Error: Content directory not found at '${DOC_DIR}'`);
    process.exit(1);
  }
  if (!fs.existsSync(WEB_DIR)) {
    console.error(`Error: Web directory not found at '${WEB_DIR}'`);
    process.exit(1);
  }

  const server = http.createServer(handleRequest);

  function shutdown() {
    console.log('\nShutting down server...');
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
    // Force exit if close takes too long (e.g. keep-alive connections)
    setTimeout(() => process.exit(0), 3000);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.listen(PORT, () => {
    console.log(`up-doc server at http://localhost:${PORT}/`);
    console.log(`  Content: ${DOC_DIR}`);
    console.log(`  SPA:     ${WEB_DIR}`);
    console.log(`  Auth:    ${AUTH_USER ? 'enabled' : 'disabled'}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Error: Port ${PORT} is already in use.`);
    } else {
      console.error(`Error starting server: ${error.message}`);
    }
    process.exit(1);
  });
}

main();
