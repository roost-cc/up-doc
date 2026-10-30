import { expect, open, scrollsSideways, url, test } from './fixtures.js';

test.describe('path resolution', () => {
  test('a directory with an index file renders it, from one listing and no failed request', async ({ page }) => {
    const failed = [];
    const listings = [];
    page.on('response', (r) => {
      if (r.status() >= 400) failed.push(r.url());
      if (r.url().includes('/_/ls/')) listings.push(new URL(r.url()).pathname);
    });
    await open(page, 'site', '/guide/');

    await expect(page.locator('main.content > h1')).toBeVisible();
    await expect(page.locator('.directory-listing')).toHaveCount(0);
    expect(listings.sort()).toEqual(['/_/ls/guide/index.json', '/_/ls/index.json']);
    expect(failed).toEqual([]);
  });

  test('a directory without an index file shows its listing, with no failed request', async ({ page }) => {
    const failed = [];
    page.on('response', (r) => {
      if (r.status() >= 400) failed.push(r.url());
    });
    await open(page, 'plain', '/dir/');

    await expect(page.locator('.directory-listing li a').first()).toHaveAttribute('href', '/dir/a%20b%231%25.md');
    expect(failed).toEqual([]);
  });

  test('a listing link opens a file with a space, # and % in its name', async ({ page }) => {
    await open(page, 'plain', '/dir/');
    await page.locator('.directory-listing li a').first().click();

    await expect(page.locator('body > h1')).toContainText('Odd name');
  });

  test('an empty directory says so', async ({ page }) => {
    await page.route('**/_/ls/dir/index.json', (route) => route.fulfill({ json: [] }));
    await open(page, 'plain', '/dir/');

    await expect(page.locator('.directory-listing .empty')).toHaveText('This directory is empty');
  });

  test('a directory that does not exist shows the listing error', async ({ page }) => {
    await page.goto(url('plain', '/nowhere/'));

    await expect(page.locator('.error')).toHaveText('Failed to load directory listing');
  });

  test('a directory path without the slash gains it', async ({ page }) => {
    await page.goto(url('plain', '/dir'));

    await expect(page).toHaveURL(url('plain', '/dir/'));
    await expect(page.locator('.directory-listing')).toBeVisible();
  });

  test('a file with no extension goes to its raw object', async ({ page }) => {
    // No extension means no text type, and the browser would download it rather than navigate
    await page.route('**/_/src/dir/notes', (route) => route.fulfill({ contentType: 'text/plain', body: 'notes' }));
    await page.goto(url('plain', '/dir/notes'));

    await expect(page).toHaveURL(url('plain', '/_/src/dir/notes'));
  });

  test('a path with no extension that is not there is not found', async ({ page }) => {
    await page.goto(url('plain', '/dir/nothing'));

    await expect(page.locator('.error')).toContainText('File not found: /dir/nothing');
  });

  test('a markdown file that is not there is not found', async ({ page }) => {
    await page.goto(url('plain', '/dir/nothing.md'));

    await expect(page.locator('.error')).toContainText('File not found: /dir/nothing.md');
  });

  test('a dotted path without a slash is the raw object, missing here', async ({ page }) => {
    const response = await page.goto(url('plain', '/v1.2'));

    expect(response?.ok()).toBe(false);
  });
});

test.describe('updated line', () => {
  test('follows the first h1 and shows the Last-Modified date', async ({ page }) => {
    const response = page.waitForResponse((r) => r.url().endsWith('/_/src/other/notes.md'));
    await open(page, 'site', '/other/notes.md');
    const lastModified = (await response).headers()['last-modified'];

    const line = page.locator('p.updated');
    await expect(line).toHaveCount(1);
    const expected = await page.evaluate((h) => `Updated ${new Date(h).toLocaleDateString()}`, lastModified);
    await expect(line).toHaveText(expected);
    await expect(page.locator('main.content > h1 + p.updated')).toHaveCount(1);
  });

  test('follows the h1 after a frontmatter table', async ({ page }) => {
    await open(page, 'site', '/guide/intro.md');

    await expect(page.locator('main.content > table.frontmatter + h1 + p.updated')).toHaveCount(1);
  });

  test('sits at the top of a page without an h1', async ({ page }) => {
    await open(page, 'site', '/untitled.md');

    await expect(page.locator('main.content > nav.breadcrumbs + p.updated')).toHaveCount(1);
  });

  test('shows without a sidebar too', async ({ page }) => {
    await open(page, 'plain', '/page.md');

    await expect(page.locator('body > h1 + p.updated')).toHaveCount(1);
  });

  test('is absent on a directory listing', async ({ page }) => {
    await open(page, 'plain', '/dir/');

    await expect(page.locator('.directory-listing')).toBeVisible();
    await expect(page.locator('p.updated')).toHaveCount(0);
  });

  test('is absent on a JSON view', async ({ page }) => {
    await open(page, 'site', '/site.json');

    await expect(page.locator('code.language-json')).toBeVisible();
    await expect(page.locator('p.updated')).toHaveCount(0);
  });

  test('is absent when the response has no Last-Modified', async ({ page }) => {
    await page.route('**/_/src/other/notes.md', async (route) => {
      const response = await route.fetch();
      const headers = { ...response.headers() };
      delete headers['last-modified'];
      await route.fulfill({ response, headers });
    });
    await open(page, 'site', '/other/notes.md');

    await expect(page.locator('main.content > h1')).toContainText('Notes');
    await expect(page.locator('p.updated')).toHaveCount(0);
  });
});

test.describe('tables', () => {
  for (const width of [360, 800, 1400]) {
    test(`the wide-table page never widens the document at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, 'site', '/guide/tables.md');

      expect(await scrollsSideways(page)).toBe(false);
    });
  }

  test('cells wrap and a table of blurbs fits its column', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await open(page, 'site', '/guide/tables.md');

    const table = page.locator('main.content > table').first();
    const td = table.locator('td').first();
    await expect(td).toHaveCSS('white-space', 'normal');
    await expect(td).toHaveCSS('overflow-wrap', 'anywhere');
    const fits = await table.evaluate((t) => t.scrollWidth <= t.clientWidth);
    expect(fits).toBe(true);
  });

  test('a table wider than the column scrolls inside its own box', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await open(page, 'site', '/guide/tables.md');

    const table = page.locator('#many-columns');
    await expect(table).toHaveCSS('overflow-x', 'auto');
    const scrolls = await table.evaluate((t) => t.scrollWidth > t.clientWidth);
    expect(scrolls).toBe(true);
    expect(await scrollsSideways(page)).toBe(false);
  });

  test('frontmatter keys keep nowrap', async ({ page }) => {
    await open(page, 'site', '/guide/intro.md');

    await expect(page.locator('table.frontmatter th').first()).toHaveCSS('white-space', 'nowrap');
  });
});
