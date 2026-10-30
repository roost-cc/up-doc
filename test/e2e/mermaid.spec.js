import { test, expect } from '@playwright/test';

import { open } from './fixtures.js';

/** Each page under `plain/mermaid/` and whether the parser renders a Mermaid fence on it. */
const PAGES = [
  { page: 'top.md', diagram: true },
  { page: 'tilde.md', diagram: true },
  { page: 'quote.md', diagram: true },
  { page: 'list.md', diagram: true },
  { page: 'nested.md', diagram: true },
  { page: 'none.md', diagram: false },
];

test.describe('mermaid mapping loads for fences in markdown containers', () => {
  for (const { page: name, diagram } of PAGES) {
    test(`${name} ${diagram ? 'fetches' : 'skips'} the docs mapping`, async ({ page }) => {
      const requests = [];
      page.on('request', (r) => requests.push(new URL(r.url()).pathname));
      await open(page, 'plain', `/mermaid/${name}`);

      await expect(page.locator('.mermaid-container')).toHaveCount(diagram ? 1 : 0);
      expect(requests.includes('/src:/mermaid/api/docs.json')).toBe(diagram);
    });
  }
});
