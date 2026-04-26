#!/usr/bin/env node

/**
 * Crawl the documentation site and verify every link resolves.
 * Probes /src:<path> for each candidate link — that endpoint is the only one
 * that returns a real 404 for missing files (the SPA shell returns 200 for
 * any *.md/*.json/directory request).
 *
 * Usage:
 *   node check-links.js [base-url] [--skip <regex>]... [--skip-file <path>]
 *
 * Default base URL: http://localhost:8082
 *
 * Skip patterns are ECMAScript regexes matched (case-sensitive) against the
 * resolved URL path. Matched links are treated as OK: not fetched, not crawled.
 */

import fs from "node:fs";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  options: {
    skip: { type: "string", multiple: true },
    "skip-file": { type: "string" },
  },
  allowPositionals: true,
});

const BASE = positionals[0] || "http://localhost:8082";

/** @type {RegExp[]} */
const skips = [];
for (const pat of values.skip ?? []) skips.push(new RegExp(pat));
if (values["skip-file"]) {
  const text = fs.readFileSync(values["skip-file"], "utf8");
  for (const raw of text.split("\n")) {
    if (/^\s*(#.*)?$/.test(raw)) continue;
    skips.push(new RegExp(raw));
  }
}

const visited = new Set();
const checked = new Set();
const broken = [];

async function findEntry() {
  for (const candidate of ["/index.md", "/INDEX.md", "/README.md"]) {
    try {
      const res = await fetch(BASE + "/src:" + candidate, { method: "HEAD" });
      if (res.status === 200) return candidate;
    } catch {
      // fall through
    }
  }
  return "/index.md";
}

const queue = [await findEntry()];

async function urlExists(path) {
  if (checked.has(path)) return true;
  try {
    const res = await fetch(BASE + "/src:" + path, { method: "HEAD" });
    if (res.status === 200) {
      checked.add(path);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function resolve(href, pagePath) {
  if (href.startsWith("/")) return href;
  const dir = pagePath.replace(/[^/]*$/, "");
  const parts = (dir + href).split("/");
  const out = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== "." && p !== "") out.push(p);
  }
  return "/" + out.join("/");
}

async function crawl(pagePath) {
  if (visited.has(pagePath)) return;
  visited.add(pagePath);

  let text;
  try {
    const res = await fetch(BASE + "/src:" + pagePath);
    if (res.status !== 200) {
      broken.push({ page: "(entry)", link: pagePath, status: res.status });
      return;
    }
    text = await res.text();
  } catch {
    broken.push({ page: "(entry)", link: pagePath, status: "ERR" });
    return;
  }

  const re = /\[[^\]]*\]\(([^)#\s]+?)(?:#[^)]*)?\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const href = m[1];
    if (
      !href ||
      href.startsWith("http") ||
      href.startsWith("mailto:") ||
      href.startsWith("data:")
    )
      continue;

    const resolved = resolve(href, pagePath);

    if (skips.some((rx) => rx.test(resolved))) {
      checked.add(resolved);
      continue;
    }

    const exists = await urlExists(resolved);
    if (!exists) {
      broken.push({ page: pagePath, link: href, resolved, status: 404 });
    }
    if (resolved.endsWith(".md") && !visited.has(resolved) && exists) {
      queue.push(resolved);
    }
  }
}

while (queue.length > 0) {
  await crawl(queue.shift());
}
console.log(
  `Crawled ${visited.size} pages, checked ${checked.size} unique URLs`,
);
if (broken.length) {
  console.log(`\n${broken.length} BROKEN LINKS:`);
  for (const b of broken) {
    console.log(`  ${b.status}  ${b.resolved || b.link}`);
    console.log(`         in ${b.page}`);
  }
  process.exit(1);
} else {
  console.log("All links OK");
}
