#!/usr/bin/env node

/**
 * up-doc — Roost documentation server.
 *
 * Serves markdown files via a client-side SPA renderer. The SPA lives in the
 * server's own `web/` directory and is served at `/_/`. Content (markdown, HTML,
 * images, etc.) is served from the configured `directory` root.
 *
 * Special URL prefixes:
 *   /_/*       → serves from the server's web/ directory (the SPA shell)
 *   /src:*     → serves raw content (used by the SPA to fetch markdown source)
 *   *.md       → redirects to /_/index.html (SPA renders client-side)
 *   /          → redirects to /_/index.html (SPA handles directory listing)
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mime from "mime-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let fileConfig = {};
try {
  fileConfig = JSON.parse(fs.readFileSync(path.resolve("config.json"), "utf8"));
} catch {
  // No config file — use env/defaults only
}

const PORT = parseInt(process.env.DOC_PORT, 10) || fileConfig.port || 8080;
const DOC_DIR = path.resolve(
  process.env.DOC_DIR || fileConfig.directory || ".",
);
const WEB_DIR = path.resolve(__dirname, "web");
const AUTH_USER = process.env.DOC_USER || null;
const AUTH_PASS = process.env.DOC_PASS || null;

/**
 * @param {string} filePath
 * @returns {string}
 */
function getMimeType(filePath) {
  return mime.lookup(filePath) || "application/octet-stream";
}

/**
 * @param {http.ServerResponse} res
 */
function sendNotFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("404 - File not found");
}

/**
 * @param {http.ServerResponse} res
 * @param {Error} error
 * @param {string} requestPath
 */
function sendError(res, error, requestPath) {
  console.error(`Error: ${error.message} for request path: ${requestPath}`);
  res.writeHead(500, { "Content-Type": "text/plain" });
  res.end("500 - Server error");
}

/**
 * @param {http.ServerResponse} res
 */
function sendUnauthorized(res) {
  res.writeHead(401, {
    "Content-Type": "text/plain",
    "WWW-Authenticate": 'Basic realm="Roost Docs"',
  });
  res.end("401 - Unauthorized");
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
  if (!header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString();
  const [user, pass] = decoded.split(":");
  return user === AUTH_USER && pass === AUTH_PASS;
}

function getIndexFile(dirPath, ...candidates) {
  const files = fs.readdirSync(dirPath);
  let indexFile = null;
  for (const candidate of candidates) {
    indexFile = files.filter((file) => file.match(candidate)).pop();
    if (indexFile) break;
  }
  return indexFile;
}

/**
 * Serve a static file from a given root directory.
 * @param {http.ServerResponse} res
 * @param {string} rootDir
 * @param {string} relativePath
 */
function serveStatic(res, rootDir, relativePath) {
  const filePath = path.normalize(path.join(rootDir, relativePath));

  // Prevent path traversal
  if (!filePath.startsWith(rootDir)) return sendNotFound(res);
  if (!fs.existsSync(filePath)) return sendNotFound(res);

  const stats = fs.statSync(filePath);
  if (stats.isDirectory()) return sendNotFound(res);

  try {
    const content = fs.readFileSync(filePath);
    const mimeType = getMimeType(filePath);
    res.writeHead(200, {
      "Content-Type": mimeType,
      "Content-Length": content.length,
      "Last-Modified": stats.mtime.toUTCString(),
    });
    res.end(content);
  } catch (error) {
    sendError(res, error, filePath);
  }
}

/**
 * Serve a content file from DOC_DIR with directory/index resolution.
 * @param {http.ServerResponse} res
 * @param {string} requestPath
 */
function serveContent(res, requestPath) {
  const filePath = path.normalize(path.join(DOC_DIR, requestPath));
  console.log(`  → ${filePath}`);

  if (filePath !== DOC_DIR && !filePath.startsWith(DOC_DIR + path.sep))
    return sendNotFound(res);
  if (!fs.existsSync(filePath)) return sendNotFound(res);

  const stats = fs.statSync(filePath);
  if (stats.isDirectory()) {
    const indexFile = getIndexFile(
      filePath,
      "index.md",
      "INDEX.md",
      "index.html",
      /^index\.md$/i,
      /^index\.html$/i,
    );
    if (indexFile) return serveContent(res, requestPath + "/" + indexFile);
    return sendNotFound(res);
  }

  try {
    const content = fs.readFileSync(filePath);
    const mimeType = getMimeType(filePath);
    res.writeHead(200, {
      "Content-Type": mimeType,
      "Content-Length": content.length,
      "Last-Modified": stats.mtime.toUTCString(),
    });
    res.end(content);
  } catch (error) {
    sendError(res, error, filePath);
  }
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function handleRequest(req, res) {
  try {
    if (!checkAuth(req)) return sendUnauthorized(res);

    const { pathname } = new URL(req.url, "http://localhost");
    const requestPath = decodeURIComponent(pathname);
    console.log(`${req.method} ${requestPath}`);

    // /_/* → serve from the server's web/ directory (SPA assets)
    if (requestPath.startsWith("/_/")) {
      return serveStatic(res, WEB_DIR, requestPath.slice(3));
    }

    // /src:* → serve raw content from DOC_DIR
    if (requestPath.startsWith("/src:")) {
      return serveContent(res, requestPath.slice(5));
    }

    // /ls:* → list directory contents as JSON
    if (requestPath.startsWith("/ls:")) {
      const dirPath = path.normalize(path.join(DOC_DIR, requestPath.slice(4)));
      if (dirPath !== DOC_DIR && !dirPath.startsWith(DOC_DIR + path.sep))
        return sendNotFound(res);
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
        return sendNotFound(res);
      }
      const entries = fs
        .readdirSync(dirPath)
        .filter((name) => !name.startsWith("."))
        .map((name) => {
          const stat = fs.statSync(path.join(dirPath, name));
          return {
            name,
            type: stat.isDirectory() ? "dir" : "file",
            size: stat.size,
          };
        })
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(entries));
      return;
    }

    // *.md → serve SPA shell (renders client-side)
    if (requestPath.endsWith(".md")) {
      return serveStatic(res, WEB_DIR, "index.html");
    }

    // *.json → serve SPA shell (renders client-side)
    if (requestPath.endsWith(".json")) {
      return serveStatic(res, WEB_DIR, "index.html");
    }

    // Directory request → serve SPA shell
    const fullPath = path.normalize(path.join(DOC_DIR, requestPath));
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      return serveStatic(res, WEB_DIR, "index.html");
    }

    // Everything else → serve from DOC_DIR
    return serveContent(res, requestPath);
  } catch (error) {
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
    console.log("\nShutting down server...");
    server.close(() => {
      console.log("Server stopped.");
      process.exit(0);
    });
    // Force exit if close takes too long (e.g. keep-alive connections)
    setTimeout(() => process.exit(0), 3000);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  server.listen(PORT, () => {
    console.log(`Roost docs server at http://localhost:${PORT}/`);
    console.log(`  Content: ${DOC_DIR}`);
    console.log(`  SPA:     ${WEB_DIR}`);
    console.log(`  Auth:    ${AUTH_USER ? "enabled" : "disabled"}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Error: Port ${PORT} is already in use.`);
    } else {
      console.error(`Error starting server: ${error.message}`);
    }
    process.exit(1);
  });
}

main();
