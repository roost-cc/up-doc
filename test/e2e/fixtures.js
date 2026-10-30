import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';

const CDN_CACHE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../test-results/cdn-cache');

/**
 * Answer a CDN request from disk, fetching each URL once per run. Every test is a fresh browser
 * context with an empty cache, and the two hosts' projects together make enough real CDN requests
 * that the last ones stall until the test times out.
 *
 * @param {import("@playwright/test").Route} route
 */
async function fromCdnCache(route) {
  const key = createHash('sha256').update(route.request().url()).digest('hex');
  const file = path.join(CDN_CACHE, key);
  if (!fs.existsSync(file)) {
    const response = await route.fetch();
    if (!response.ok()) return route.fulfill({ response });
    const entry = {
      status: response.status(),
      headers: response.headers(),
      body: (await response.body()).toString('base64'),
    };
    fs.mkdirSync(CDN_CACHE, { recursive: true });
    // Workers race for the same URL: the rename makes the last whole file win
    const partial = `${file}.${process.pid}`;
    fs.writeFileSync(partial, JSON.stringify(entry));
    fs.renameSync(partial, file);
  }
  const { status, headers, body } = JSON.parse(fs.readFileSync(file, 'utf8'));
  return route.fulfill({ status, headers, body: Buffer.from(body, 'base64') });
}

/** Tests that block a CDN URL use `page.route`, which is asked before this context route. */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route((url) => url.hostname !== 'localhost', fromCdnCache);
    await use(context);
  },
});

/** The fixture roots under `test/fixtures/` and the port each one's server listens on. */
export const FIXTURES = {
  plain: 4181,
  site: 4182,
  search: 4183,
  'search-lunr': 4184,
  'search-major': 4185,
  'search-malformed': 4186,
};

/**
 * @param {keyof typeof FIXTURES} name
 * @param {string} pathname
 * @returns {string}
 */
export function url(name, pathname) {
  return `http://localhost:${FIXTURES[name]}${pathname}`;
}

/**
 * Open `pathname` and wait until the page has rendered its content.
 *
 * @param {import("@playwright/test").Page} page
 * @param {keyof typeof FIXTURES} name
 * @param {string} pathname
 */
export async function open(page, name, pathname) {
  await page.goto(url(name, pathname));
  await page.locator('nav.breadcrumbs').waitFor();
}

/**
 * Whether the document is wider than the viewport (the page scrolls sideways).
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<boolean>}
 */
export function scrollsSideways(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}
