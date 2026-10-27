import { test, expect } from '@playwright/test';

import { open } from './fixtures.js';

/** Each chart page under `plain/vega-lite/` and the SVG marks its spec draws. */
const CHARTS = [
  { page: 'stacked-area.md', marks: ['.mark-area'] },
  { page: 'layered.md', marks: ['.mark-rect', '.mark-line'] },
];

/** The title's fill in Vega's default theme and in its `dark` theme. */
const TITLE_FILL = { light: '#000', dark: '#fff' };

const titleFill = (page) => page.locator('div.vega-lite svg .role-title-text text').getAttribute('fill');

test.describe('vega-lite fences render as charts', () => {
  for (const { page: name, marks } of CHARTS) {
    for (const scheme of /** @type {const} */ (['light', 'dark'])) {
      test(`${name} draws an svg in the ${scheme} scheme`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, 'plain', `/vega-lite/${name}`);

        const chart = page.locator('div.vega-lite');
        await expect(chart.locator('svg')).toHaveCount(1);
        for (const mark of marks) {
          await expect(chart.locator(`svg ${mark}`).first()).toBeAttached();
        }
        expect(await titleFill(page)).toBe(TITLE_FILL[scheme]);
        // The fence's source is not shown as code, and the text after it renders
        await expect(page.locator('pre code')).toHaveCount(0);
        await expect(page.getByText('After the chart.')).toBeVisible();
        // `width: "container"` fills the content column
        const box = await chart.locator('svg').boundingBox();
        expect(box?.width).toBeGreaterThan(300);
      });
    }
  }

  test('a chart redraws when the scheme changes', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await open(page, 'plain', '/vega-lite/stacked-area.md');
    await expect(page.locator('div.vega-lite svg')).toHaveCount(1);
    expect(await titleFill(page)).toBe(TITLE_FILL.light);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => titleFill(page)).toBe(TITLE_FILL.dark);
    await expect(page.locator('div.vega-lite svg')).toHaveCount(1);
  });

  test('an invalid block shows its source under an error', async ({ page }) => {
    await open(page, 'plain', '/vega-lite/invalid.md');

    const invalid = page.locator('.vega-lite-invalid');
    await expect(invalid).toHaveCount(2);
    await expect(invalid.nth(0).locator('.error')).toContainText('Vega-Lite chart not drawn:');
    await expect(invalid.nth(0).locator('pre code')).toContainText('"values": [ }');
    await expect(invalid.nth(1).locator('.error')).toContainText('Vega-Lite chart not drawn:');
    await expect(invalid.nth(1).locator('pre code')).toContainText('"data": { "values": [{ "a": 1 }] }');

    // The rest of the page renders: the valid chart, the diagram and the highlighted code
    await expect(page.locator('div.vega-lite svg')).toHaveCount(1);
    await expect(page.locator('.mermaid-container svg')).toHaveCount(1);
    await expect(page.locator('pre code.hljs').last()).toContainText('the rest of the page');
  });

  test('a page without a vega-lite fence loads no chart script', async ({ page }) => {
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    await open(page, 'plain', '/vega-lite/none.md');

    await expect(page.locator('pre code.hljs')).toHaveCount(1);
    expect(requests.filter((u) => /\/npm\/vega(-lite|-embed)?@/.test(u))).toEqual([]);
  });
});
