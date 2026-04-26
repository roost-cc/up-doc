#!/usr/bin/env node

/**
 * One-shot link checker: starts the doc-server on a free ephemeral port,
 * runs the crawler against it, then tears the server down.
 *
 * Usage:
 *   node scripts/check.js [--doc-dir <path>] [--skip-file <path>] [--skip <regex>]...
 *
 * Exits with the crawler's exit code (0 = OK, 1 = broken links / IO error).
 */

import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "doc-dir": { type: "string" },
    skip: { type: "string", multiple: true },
    "skip-file": { type: "string" },
  },
  allowPositionals: true,
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const port = await new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.unref();
  srv.on("error", reject);
  srv.listen(0, () => {
    const p = /** @type {{ port: number }} */ (srv.address()).port;
    srv.close(() => resolve(p));
  });
});

const server = spawn("node", ["docserver.js"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    DOC_PORT: String(port),
    DOC_DIR: values["doc-dir"] || process.env.DOC_DIR || process.cwd(),
  },
  stdio: ["ignore", "inherit", "inherit"],
});

let shuttingDown = false;
let exitCode = 0;

function shutdown(code) {
  if (typeof code === "number") exitCode = code;
  if (shuttingDown) return;
  shuttingDown = true;
  if (server.exitCode === null && !server.killed) server.kill("SIGTERM");
  const force = setTimeout(() => {
    if (server.exitCode === null && !server.killed) server.kill("SIGKILL");
  }, 3000);
  force.unref();
  if (server.exitCode !== null) process.exit(exitCode);
  server.on("exit", () => process.exit(exitCode));
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));
process.on("uncaughtException", (e) => {
  console.error(e);
  shutdown(1);
});

server.on("exit", (code, signal) => {
  if (!shuttingDown) {
    console.error(
      `doc-server exited unexpectedly (code=${code} signal=${signal})`,
    );
    shutdown(1);
  }
});

const base = `http://localhost:${port}`;
const deadline = Date.now() + 10_000;
let ready = false;
while (Date.now() < deadline) {
  try {
    await fetch(base + "/");
    ready = true;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 250));
  }
}
if (!ready) {
  console.error("doc-server did not become ready within 10s");
  shutdown(1);
} else {
  const crawlerArgs = [path.join("scripts", "check-links.js"), base];
  if (values["skip-file"]) crawlerArgs.push("--skip-file", values["skip-file"]);
  for (const s of values.skip ?? []) crawlerArgs.push("--skip", s);

  const crawler = spawn("node", crawlerArgs, {
    cwd: repoRoot,
    stdio: "inherit",
  });
  crawler.on("exit", (code) => shutdown(code ?? 1));
}
