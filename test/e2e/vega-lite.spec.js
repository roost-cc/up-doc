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

  test('weekly bars retain ISO Monday coordinates including year boundaries', async ({ page }) => {
    await open(page, 'plain', '/vega-lite/layered.md');
    await expect(page.locator('div.vega-lite svg')).toHaveCount(1);

    // Lay the page's own spec out again, headless, to read each bar's edges in scale units
    const source = decodeURIComponent(await page.locator('div.vega-lite').getAttribute('data-source'));
    const bars = await page.evaluate(async (text) => {
      const view = new window.vega.View(window.vega.parse(window.vegaLite.compile(JSON.parse(text)).spec), {
        renderer: 'none',
      });
      await view.runAsync();
      const x = view.scale('x');
      const day = (px) => new Date(x.invert(px)).toISOString().slice(0, 10);
      const rects = [];
      const walk = (node) => {
        if (node.marktype === 'rect' && node.role === 'mark') {
          for (const item of node.items) rects.push([day(item.x), day(item.x + item.width)]);
        }
        for (const child of node.items ?? []) walk(child);
      };
      walk(view.scenegraph().root);
      return rects.sort();
    }, source);

    // Monday to Monday, across the year boundary (ISO 2026-W01 starts on 2025-12-29)
    expect(bars).toEqual([
      ['2025-12-15', '2025-12-22'],
      ['2025-12-22', '2025-12-29'],
      ['2025-12-29', '2026-01-05'],
      ['2026-01-05', '2026-01-12'],
      ['2026-01-12', '2026-01-19'],
    ]);
  });

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

  for (const script of ['vega', 'vega-lite', 'vega-embed']) {
    test(`vega_dependency_failure_preserves_page_and_chart_sources: ${script} unavailable`, async ({ page }) => {
      await page.route(new RegExp(`/npm/${script}@`), (route) => route.abort());
      await open(page, 'plain', '/vega-lite/invalid.md');

      // Every block, valid or not, shows its source under an error, and the rest of the page renders
      const invalid = page.locator('.vega-lite-invalid');
      await expect(invalid).toHaveCount(3);
      await expect(invalid.nth(2).locator('.error')).toContainText('Vega-Lite chart not drawn: the chart scripts did not load');
      await expect(invalid.nth(2).locator('pre code')).toContainText('"b": 5');
      await expect(page.locator('div.vega-lite')).toHaveCount(0);
      await expect(page.locator('.mermaid-container svg')).toHaveCount(1);
      await expect(page.locator('pre code.hljs').last()).toContainText('the rest of the page');
    });
  }

  test('a page without a vega-lite fence loads no chart script', async ({ page }) => {
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    await open(page, 'plain', '/vega-lite/none.md');

    await expect(page.locator('pre code.hljs')).toHaveCount(1);
    expect(requests.filter((u) => /\/npm\/vega(-lite|-embed)?@/.test(u))).toEqual([]);
  });
});
