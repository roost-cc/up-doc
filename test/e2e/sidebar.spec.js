import { test, expect } from "@playwright/test";

import { open, scrollsSideways, url } from "./fixtures.js";

test.describe("without site.json", () => {
  test("no sidebar, no toggle and no console output", async ({ page }) => {
    const messages = [];
    page.on("console", (m) => messages.push(`${m.type()}: ${m.text()}`));
    page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
    const missing = [];
    page.on("response", (r) => {
      if (r.status() === 404) missing.push(r.url());
    });

    await open(page, "plain", "/page.md");

    await expect(page.locator("nav.sidebar")).toHaveCount(0);
    await expect(page.locator(".sidebar-toggle")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/has-sidebar/);
    await expect(page.locator("body > h1")).toContainText("A page");
    expect(messages).toEqual([]);
    expect(missing).toEqual([]);
  });
});

test.describe("with site.json", () => {
  test("lists the root title and one details per section", async ({ page }) => {
    await open(page, "site", "/other/notes.md");

    const nav = page.locator("nav.sidebar");
    await expect(nav.locator(".sidebar-root")).toHaveText("Fixture docs");
    await expect(nav.locator(".sidebar-root")).toHaveAttribute("href", "/");
    await expect(nav.locator("details > summary")).toHaveText([
      "Guide",
      "Other",
    ]);
    await expect(page.locator("body")).toHaveClass(/has-sidebar/);
    await expect(page.locator("main.content > h1")).toContainText("Notes");
  });

  test("opens the section of the current entry", async ({ page }) => {
    await open(page, "site", "/other/notes.md");

    const sections = page.locator("nav.sidebar details");
    await expect(sections.nth(0)).not.toHaveAttribute("open");
    await expect(sections.nth(1)).toHaveAttribute("open");
    await expect(page.locator('nav.sidebar [aria-current="page"]')).toHaveText(
      "Notes",
    );
  });

  test("marks a hub's nested entry current", async ({ page }) => {
    await open(page, "site", "/guide/ref/beta.md");

    const guide = page.locator("nav.sidebar details").nth(0);
    await expect(guide).toHaveAttribute("open");
    const hub = guide.locator("li", {
      has: page.locator('a[href="/guide/reference.md"]'),
    });
    await expect(hub.locator("ul a")).toHaveText(["Alpha", "Beta"]);
    const current = page.locator('nav.sidebar [aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText("Beta");
    await expect(current).toHaveAttribute("href", "/guide/ref/beta.md");
  });

  test("a directory and its index.md are the same page", async ({ page }) => {
    for (const pathname of ["/guide/", "/guide/index.md"]) {
      await open(page, "site", pathname);
      const current = page.locator('nav.sidebar [aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText("Guide");
      await expect(page.locator("nav.sidebar details").nth(0)).toHaveAttribute(
        "open",
      );
    }
  });

  test("a page that is no entry opens the section of the longest prefix", async ({
    page,
  }) => {
    await open(page, "site", "/guide/deep/unlisted.md");

    const sections = page.locator("nav.sidebar details");
    await expect(sections.nth(0)).toHaveAttribute("open");
    await expect(sections.nth(1)).not.toHaveAttribute("open");
    await expect(page.locator('nav.sidebar [aria-current="page"]')).toHaveCount(
      0,
    );
  });

  test("a page under no entry's directory opens nothing", async ({ page }) => {
    await open(page, "site", "/loose.md");

    await expect(page.locator("nav.sidebar details[open]")).toHaveCount(0);
  });

  test("a missing page keeps the sidebar beside its error", async ({
    page,
  }) => {
    await page.goto(url("site", "/guide/no-such-page.md"));

    await expect(page.locator("main.content > .error")).toContainText(
      "File not found",
    );
    await expect(page.locator("nav.sidebar .sidebar-root")).toBeVisible();
  });
});

test.describe("narrow screens", () => {
  test("at 360px the sidebar hides behind a Menu toggle", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page, "site", "/guide/intro.md");

    const nav = page.locator("nav.sidebar");
    const toggle = page.getByRole("button", { name: "Menu" });
    await expect(nav).toBeHidden();
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(nav).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(await scrollsSideways(page)).toBe(false);

    await toggle.click();
    await expect(nav).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("the content keeps a 16px gutter", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page, "site", "/guide/intro.md");

    const box = await page.locator("main.content").boundingBox();
    expect(box.x).toBe(16);
    expect(box.x + box.width).toBe(360 - 16);
  });

  test("the toggle is hidden on a wide screen", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await open(page, "site", "/guide/intro.md");

    await expect(page.locator("nav.sidebar")).toBeVisible();
    await expect(page.locator(".sidebar-toggle")).toBeHidden();
  });
});
