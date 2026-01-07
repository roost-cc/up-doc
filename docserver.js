#!/usr/bin/env node

/**
 * Simple Markdown documentation server.
 */

import * as http from 'http';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import * as url from 'url';
import * as mime from 'mime-types';
import * as child_process from 'child_process';
import * as os from 'os';

// Get the directory where docserver.js is located
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

let doc_dir = process.cwd();
// Get document directory from command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.error('Usage: docserver.js [--help|-h] <directory>');
  console.error('  --help|-h: Show this help message');
  console.error('  <directory>: The directory to serve (default: current directory)');
  process.exit(1);
}

/**
 * Selects a random unprivileged port between 1024 and 65535
 */
function getRandomPort() {
  const port = Math.floor(Math.random() * (65535 - 1024 + 1)) + 1024;
  return port;
}

/**
 * Open the default browser with the given URL
 * @param {string} url - URL to open
 */
function openBrowser(url) {
  console.log('openBrowser()');
  const osPlatform = os.platform();
  let command;

  switch (osPlatform) {
    case 'darwin': // macOS
      command = `open "${url}"`;
      break;
    case 'win32': // Windows
      command = `start "" "${url}"`;
      break;
    default: // Linux and others
      command = `xdg-open "${url}"`;
      break;
  }

  child_process.exec(command, (error) => {
    if (error) {
      // Silently fail if browser can't be opened
      console.warn(`Could not open browser: ${error.message}`);
    }
  });
}

/**
 * Get MIME type based on file extension
 * @param {string} filePath - Path to the file
 * @returns {string} MIME type
 */
function getMimeType(filePath) {
  return mime.lookup(filePath) || 'application/octet-stream';
}

/**
 * Send a 404 Not Found response
 * @param {http.ServerResponse} res - Response object
 */
function sendNotFound(res) {
  const message = '404 - File not found';
  const contentLength = Buffer.byteLength(message);
  // Store Content-Length for logging
  res._contentLength = contentLength;
  res.writeHead(404, { 
    'Content-Type': 'text/plain',
    'Content-Length': contentLength
  });
  res.end(message);
}

/**
 * Send a 500 Server Error response
 * @param {http.ServerResponse} res - Response object
 * @param {Error} error - Error object
 * @param {string} requestPath - Request path that caused the error
 */
function sendError(res, error, requestPath) {
  console.error(`Error: ${error.message} for request path: ${requestPath}`);
  const message = '500 - Server error';
  const contentLength = Buffer.byteLength(message);
  // Store Content-Length for logging
  res._contentLength = contentLength;
  res.writeHead(500, { 
    'Content-Type': 'text/plain',
    'Content-Length': contentLength
  });
  res.end(message);
}

async function getIndexFile(dirPath, ...candidates) {
  // list the files in the directory
  const files = await fsPromises.readdir(dirPath);
  for (const candidate of candidates) {
    const indexFile = files.filter((file) => file.match(candidate)).shift();
    if (indexFile) {
      return indexFile;
    }
  }
  return null;
}
/**
 * Serve a file with appropriate headers
 * @param {http.ServerResponse} res - Response object
 * @param {string} filePath - The local file path to serve
 */
async function serveFile(res, filePath, stats) {
  // Read and serve the file
  const [content, fileStats] = await Promise.all([
    fsPromises.readFile(filePath),
    stats ? Promise.resolve(stats) : fsPromises.stat(filePath)
  ]);
  const mimeType = getMimeType(filePath);

  // Store Content-Length for logging (since getHeader() may not work after end())
  res._contentLength = content.length;

  res.writeHead(200, {
    'Content-Type': mimeType,
    'Content-Length': content.length,
    'Last-Modified': fileStats.mtime.toUTCString(),
  });
  res.end(content);
}

/**
 * Logs the request response in common log format 
 * host ident authuser timestamp request-line status bytes
 * @param {http.ServerResponse} res - Response object
 * @param {http.IncomingMessage} req - Request object
 */
function logResponse(res, req) {
  // Use stored Content-Length if available, otherwise try getHeader, otherwise use '-'
  const contentLength = res._contentLength ?? (res.getHeader('content-length') || res.getHeader('Content-Length')) ?? '-';
  console.log(`${req.headers.host} - - [${new Date().toISOString()}] "${req.method} ${req.url} HTTP/1.1" ${res.statusCode} ${res.statusMessage} ${contentLength}`);
}

/**
 * Request handler
 * @param {http.IncomingMessage} req - Request object
 * @param {http.ServerResponse} res - Response object
 */
async function handleRequest(req, res) {
  try {
    // Parse URL
    const parsedUrl = url.parse(req.url, true);
    // decode and trim the leading '/'
    const requestPath = decodeURIComponent(parsedUrl.pathname).replace(/^\//, '');
    
    // Handle .md files - serve index.html unless the source is requested
    const send_source = requestPath.startsWith('src:');
    let is_markdown = requestPath.endsWith('.md');
    const is_server_file = requestPath.startsWith('_/');
    let filePath;
    let stats;
    let not_found = false;
    let err = null;

    // add in index file if necessary
    if (!is_server_file && !is_markdown) {
      filePath = path.join(doc_dir, requestPath);
      try {
        stats = await fsPromises.stat(filePath);
        if (stats.isDirectory()) {
          const indexFile = await getIndexFile(filePath, 'INDEX.md', 'index.html', /^index\.md+$/i, /^index\.html+$/i);
          if (indexFile) {
            is_markdown = indexFile.endsWith('.md');
            filePath = path.join(filePath, indexFile); 
          } else {
            not_found = true;
          }
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          not_found = true;
        } else {
          err = error;
        }
      }
    }
   
    if (is_markdown && !send_source) { // serve the server index.html which converts the markdown to html on the fly
      filePath = path.join(__dirname, "web", "index.html");
    } else if (is_server_file) { // serve the server file
      filePath = path.join(__dirname, "web", requestPath.slice(2));
    } else if (send_source) {
      filePath = path.join(doc_dir, requestPath.slice(4));
    } else if (not_found) { // serve the document file
      const error = new Error(`No such file or directory, ${filePath}`);
      error.code = 'ENOENT';
      throw error;
    } else if (err) {
      throw err;
    }
    await serveFile(res, filePath, stats); // serve the file
  } catch (error) {
    if (error.code === 'ENOENT') {
      sendNotFound(res);
    } else {
      console.error(error);
      sendError(res, error, req.url);
    }
  } finally {
    logResponse(res, req);
  }
}

// Function to try listening on a port
function tryListen(server) {
  console.log('tryListen()');
  const port = getRandomPort();
  
  // Remove any existing error listeners to avoid duplicates
  server.removeAllListeners('error');
  
  // Handle server errors - retry if port is in use
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is already in use, trying another port...`);
      tryListen(server); // Retry with a new port
    } else {
      console.error(`Error starting server: ${error.message}`);
      process.exit(1);
    }
  });

  // Try to listen on the port
  server.listen(port, () => {
    // Remove error handler since we successfully started listening
    server.removeAllListeners('error');
    const serverUrl = `http://localhost:${port}/`;
    console.log(`Serving at ${serverUrl}`);
    console.log(`Serving files from: ${doc_dir}`);
    console.log('Press Ctrl+C to stop the server');
    openBrowser(serverUrl);
  });
}

// Handle graceful shutdown
let shutdownAttempts = 0;
function shutdown(server) {
  console.log(`\nShutting down server... (${shutdownAttempts})`);
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
  shutdownAttempts++;
  if (shutdownAttempts < 3) {
    setTimeout(() => shutdown(server), 1000);
  } else {
    process.exit(1);
  }
}

/**
 * Main function to start the server
 */
function main() {
  console.log('main()');
  // get the absolute path to the document directory
  doc_dir = path.resolve((args[0] || process.cwd()).trim().replace(/^~/, os.homedir()));
  // Verify document directory exists
  if (!fs.existsSync(doc_dir)) {
    console.error(`Error: Directory not found at '${doc_dir}'`);
    process.exit(1);
  }

  // Create HTTP server
  const server = http.createServer(handleRequest);

  process.on('SIGINT', () => shutdown(server));
  process.on('SIGTERM', () => shutdown(server));

  // Start trying to listen
  tryListen(server);
}

// Run the server
main();
