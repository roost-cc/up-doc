#!/usr/bin/env node

/**
 * Crawl the documentation site and verify every link resolves.
 * Works by fetching raw markdown via /src: and checking all [text](url) links.
 *
 * Usage: node check-links.mjs [base-url]
 * Default: http://localhost:8082
 */

const BASE = process.argv[2] || 'http://localhost:8082';
const visited = new Set();
const checked = new Set();
const broken = [];
const queue = ['/index.md'];

async function urlExists(path) {
  if (checked.has(path)) return true;
  try {
    // Try raw source (for .md files)
    let res = await fetch(BASE + '/src:' + path, { method: 'HEAD' });
    if (res.status === 200) {
      checked.add(path);
      return true;
    }
    // Try as served URL (for .html, directories)
    res = await fetch(BASE + path, { method: 'HEAD' });
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
    const res = await fetch(BASE + '/src:' + pagePath);
    if (res.status !== 200) {
      broken.push({ page: '(entry)', link: pagePath, status: res.status });
      return;
    }
    text = await res.text();
  } catch (e) {
    broken.push({ page: '(entry)', link: pagePath, status: 'ERR' });
    return;
  }

  // Extract [text](url) markdown links
  const re = /\[[^\]]*\]\(([^)#\s]+?)(?:#[^)]*)?\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const href = m[1];
    if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('data:')) continue;

    const resolved = resolve(href, pagePath);
    const exists = await urlExists(resolved);
    if (!exists) {
      broken.push({ page: pagePath, link: href, resolved, status: 404 });
    }
    if (resolved.endsWith('.md') && !visited.has(resolved) && exists) {
      queue.push(resolved);
    }
  }
}

(async () => {
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
})();
