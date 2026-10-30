import { expect, open, url, test } from './fixtures.js';

const CDN = '**/npm/minisearch@*/**';

/**
 * Record the console and the requests a page makes.
 *
 * @param {import("@playwright/test").Page} page
 */
function watch(page) {
  const seen = { messages: [], warnings: [], requests: [] };
  page.on('console', (m) => {
    seen.messages.push(`${m.type()}: ${m.text()}`);
    if (m.type() === 'warning') seen.warnings.push(m.text());
  });
  page.on('pageerror', (e) => seen.messages.push(`pageerror: ${e.message}`));
  page.on('request', (r) => seen.requests.push(`${r.method()} ${r.url()}`));
  return seen;
}

/** @param {string[]} requests */
const searchRequests = (requests) => requests.filter((r) => /search\.json|minisearch/.test(r));

/**
 * Type `query` and wait for the result list.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} query
 */
async function find(page, query) {
  await page.locator('.search-box').fill(query);
  const list = page.locator('.search-results');
  await expect(list).toBeVisible();
  return list.locator('li a');
}

test.describe('without search.json', () => {
  test('no box, no search request and no console output', async ({ page }) => {
    const seen = watch(page);
    await open(page, 'plain', '/page.md');

    await expect(page.locator('body > h1')).toContainText('A page');
    await expect(page.locator('.search')).toHaveCount(0);
    expect(searchRequests(seen.requests)).toEqual([]);
    expect(seen.requests.filter((r) => r.endsWith('/_/ls/index.json')).length).toBeLessThanOrEqual(1);
    expect(seen.messages).toEqual([]);
  });
});

test.describe('with search.json', () => {
  test('the box sits at the top of a page without a sidebar', async ({ page }) => {
    await open(page, 'search', '/app/tenets.md');

    const box = page.locator('body > .search:first-child .search-box');
    await expect(box).toBeVisible();
    await expect(box).toHaveAttribute('placeholder', 'Search');
    await expect(page.locator('body > .search + nav.breadcrumbs')).toHaveCount(1);
    await expect(page.locator('nav.sidebar')).toHaveCount(0);
  });

  test('the box heads the sidebar when there is one', async ({ page }) => {
    await open(page, 'site', '/guide/intro.md');

    await expect(page.locator('nav.sidebar > .sidebar-root + .search .search-box')).toBeVisible();
    await expect(page.locator('main.content .search')).toHaveCount(0);
    const links = await find(page, 'beta');
    await expect(links.first()).toHaveAttribute('href', '/guide/ref/beta.md');
  });

  test('nothing is fetched before the first keystroke', async ({ page }) => {
    const seen = watch(page);
    await open(page, 'search', '/app/tenets.md');
    await expect(page.locator('.search-box')).toBeVisible();

    expect(searchRequests(seen.requests)).toEqual([]);
    expect(seen.messages).toEqual([]);

    await find(page, 'tenets');
    expect(searchRequests(seen.requests)).toEqual([
      `GET ${url('search', '/_/src/search.json')}`,
      'GET https://cdn.jsdelivr.net/npm/minisearch@7.2.0/dist/umd/index.js',
    ]);
    expect(seen.messages).toEqual([]);
  });

  test('tenets finds the tenets page', async ({ page }) => {
    await open(page, 'search', '/index.md');
    const links = await find(page, 'tenets');

    await expect(links.first()).toHaveText('Tenets');
    await expect(links.first()).toHaveAttribute('href', '/app/tenets.md');
    await expect(page.locator('.search-results li').first().locator('.search-section')).toHaveText('app');
  });

  test('xattrs finds the storage page by a heading', async ({ page }) => {
    await open(page, 'search', '/index.md');
    const links = await find(page, 'xattrs');

    await expect(links).toHaveCount(1);
    await expect(links).toHaveAttribute('href', '/platform/storage.md');
    await expect(links).toHaveText('Storage');
  });

  test('inspec matches inspection by prefix', async ({ page }) => {
    await open(page, 'search', '/index.md');
    const links = await find(page, 'inspec');

    await expect(links.first()).toHaveAttribute('href', '/app/inspections.md');
  });

  test('a phrase from a body finds its page', async ({ page }) => {
    await open(page, 'search', '/index.md');
    const links = await find(page, 'copper kettle whistles');

    await expect(links.first()).toHaveAttribute('href', '/stories/kettle.md');
    await expect(links.first()).toHaveText('A story about the kitchen');
  });

  test('Escape clears the box and the list', async ({ page }) => {
    await open(page, 'search', '/index.md');
    await find(page, 'tenets');

    await page.locator('.search-box').press('Escape');
    await expect(page.locator('.search-box')).toHaveValue('');
    await expect(page.locator('.search-results')).toBeHidden();
    await expect(page.locator('.search-results li')).toHaveCount(0);
  });

  test('an emptied box shows no list', async ({ page }) => {
    await open(page, 'search', '/index.md');
    await find(page, 'tenets');

    await page.locator('.search-box').fill('');
    await expect(page.locator('.search-results')).toBeHidden();
  });

  test('Enter opens the first result', async ({ page }) => {
    await open(page, 'search', '/index.md');
    await find(page, 'xattrs');

    await page.locator('.search-box').press('Enter');
    await expect(page).toHaveURL(url('search', '/platform/storage.md'));
    await expect(page.locator('body > h1')).toContainText('Storage');
  });
});

test.describe('search unavailable', () => {
  /**
   * Type into the box and expect it disabled with one warning naming `reason`.
   *
   * @param {import("@playwright/test").Page} page
   * @param {ReturnType<typeof watch>} seen
   * @param {RegExp} reason
   */
  async function expectDisabled(page, seen, reason) {
    const box = page.locator('.search-box');
    await box.fill('tenets');
    await expect(box).toBeDisabled();
    await expect(box).toHaveAttribute('placeholder', 'search unavailable');
    await expect(box).toHaveValue('');
    await expect(page.locator('.search-results li')).toHaveCount(0);
    expect(seen.warnings).toHaveLength(1);
    expect(seen.warnings[0]).toMatch(/^\[up-doc\] search unavailable: /);
    expect(seen.warnings[0]).toMatch(reason);
    await expect(page.locator('nav.breadcrumbs + h1')).toBeVisible();
  }

  const cases = [
    ['search-lunr', /engine "lunr"/],
    ['search-major', /minisearch "6\.3\.0", not major 7/],
    ['search-malformed', /not valid JSON/],
  ];
  for (const [root, reason] of cases) {
    test(`${root}: disabled before the CDN is reached`, async ({ page }) => {
      const seen = watch(page);
      await open(page, root, '/index.md');
      await expectDisabled(page, seen, reason);
      expect(seen.requests.filter((r) => r.includes('minisearch'))).toEqual([]);
    });
  }

  test('a failed fetch of search.json disables the box', async ({ page }) => {
    const seen = watch(page);
    await page.route('**/_/src/search.json', (route) => route.abort());
    await open(page, 'search', '/index.md');
    await expectDisabled(page, seen, /cannot fetch search\.json/);
  });

  test('a blocked CDN script disables the box', async ({ page }) => {
    const seen = watch(page);
    await page.route(CDN, (route) => route.abort());
    await open(page, 'search', '/index.md');
    await expectDisabled(page, seen, /cannot load https:\/\/cdn\.jsdelivr/);
  });
});
