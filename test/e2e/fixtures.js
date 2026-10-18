/** The fixture roots under `test/fixtures/` and the port each one's server listens on. */
export const FIXTURES = {
  plain: 4181,
  site: 4182,
  search: 4183,
  "search-lunr": 4184,
  "search-major": 4185,
  "search-malformed": 4186,
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
  await page.locator("nav.breadcrumbs").waitFor();
}

/**
 * Whether the document is wider than the viewport (the page scrolls sideways).
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<boolean>}
 */
export function scrollsSideways(page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}
