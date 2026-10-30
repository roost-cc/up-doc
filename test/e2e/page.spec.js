import { expect, open, scrollsSideways, test } from './fixtures.js';

test.describe('updated line', () => {
  test('follows the first h1 and shows the Last-Modified date', async ({ page }) => {
    const response = page.waitForResponse((r) => r.url().endsWith('/src:/other/notes.md'));
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
    await page.route('**/src:/other/notes.md', async (route) => {
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
