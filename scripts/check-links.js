#!/usr/bin/env node

/**
 * Crawl the documentation site and verify every link resolves.
 * Probes /_/src/<path> for each candidate link — that prefix is the only one
 * that answers for the file itself (the SPA shell returns 200 for any
 * *.md/*.json/directory request). /_/src/ serves exact files only, so a link
 * to a directory resolves through its /_/ls/ listing and passes only if the
 * directory holds an index file.
 *
 * Usage:
 *   node check-links.js [base-url] [--skip-file <path>] [--skip <regex>]...
 *
 * Default base URL: http://localhost:8082
 *
 * Skip patterns are ECMAScript regexes matched (case-sensitive) against the
 * resolved URL path. Matched links are treated as OK: not fetched, not crawled.
 */

import fs from 'node:fs';
import { parseArgs } from 'node:util';

import { indexName, listingUrl, srcUrl } from '../web/util.js';
import { extractLinks } from './markdown-links.js';

const { values, positionals } = parseArgs({
  options: {
    skip: { type: 'string', multiple: true },
    'skip-file': { type: 'string' },
  },
  allowPositionals: true,
});

const BASE = positionals[0] || 'http://localhost:8082';

/** @type {RegExp[]} */
const skips = [];
for (const pat of values.skip ?? []) skips.push(new RegExp(pat));
if (values['skip-file']) {
  const skipFile = values['skip-file'];
  const text = fs.readFileSync(skipFile, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*(#.*)?$/.test(raw)) continue;
    const pattern = raw.trim();
    try {
      skips.push(new RegExp(pattern));
    } catch (err) {
      throw new Error(`Invalid regex in ${skipFile}:${i + 1}: ${pattern}\n  ${err.message}`);
    }
  }
}

const visited = new Set();
const checked = new Set();
const broken = [];

async function findEntry() {
  for (const candidate of ['/index.md', '/INDEX.md', '/README.md']) {
    try {
      const res = await fetch(BASE + srcUrl(candidate), { method: 'HEAD' });
      if (res.status === 200) {
        checked.add(candidate);
        return candidate;
      }
    } catch {
      // fall through
    }
  }
  return '/index.md';
}

const queue = [await findEntry()];

/** @param {string} path */
async function hasIndexFile(path) {
  const res = await fetch(BASE + listingUrl(path.replace(/[?#].*$/, '')));
  return res.status === 200 && indexName(await res.json()) !== null;
}

async function urlExists(path) {
  if (checked.has(path)) return true;
  try {
    const res = await fetch(BASE + srcUrl(path), { method: 'HEAD' });
    if (res.status === 200 || (await hasIndexFile(path))) {
      checked.add(path);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function resolve(href, pagePath) {
  if (href.startsWith('/')) return href;
  const dir = pagePath.replace(/[^/]*$/, '');
  const parts = (dir + href).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  }
  return '/' + out.join('/');
}

async function crawl(pagePath) {
  if (visited.has(pagePath)) return;
  visited.add(pagePath);

  let text;
  try {
    const res = await fetch(BASE + srcUrl(pagePath));
    if (res.status !== 200) {
      broken.push({ page: '(entry)', link: pagePath, status: res.status });
      return;
    }
    text = await res.text();
  } catch {
    broken.push({ page: '(entry)', link: pagePath, status: 'ERR' });
    return;
  }

  for (const href of extractLinks(text)) {
    if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('data:')) continue;

    const resolved = resolve(href, pagePath);

    if (skips.some((rx) => rx.test(resolved))) {
      checked.add(resolved);
      continue;
    }

    const exists = await urlExists(resolved);
    if (!exists) {
      broken.push({ page: pagePath, link: href, resolved, status: 404 });
    }
    if (resolved.endsWith('.md') && !visited.has(resolved) && exists) {
      queue.push(resolved);
    }
  }
}

while (queue.length > 0) {
  await crawl(queue.shift());
}
console.log(`Crawled ${visited.size} pages, checked ${checked.size} unique URLs`);
if (broken.length) {
  console.log(`\n${broken.length} BROKEN LINKS:`);
  for (const b of broken) {
    console.log(`  ${b.status}  ${b.resolved || b.link}`);
    console.log(`         in ${b.page}`);
  }
  process.exit(1);
} else {
  console.log('All links OK');
}
