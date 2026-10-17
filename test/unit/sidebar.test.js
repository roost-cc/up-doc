import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normalise, openSection, parse } from "../../web/sidebar.js";

const manifest = {
  root: { title: "Docs" },
  sections: [
    {
      title: "App",
      path: "/app/index.md",
      entries: [
        { title: "Tenets", path: "/app/tenets.md" },
        {
          title: "Stories",
          path: "/app/stories.md",
          entries: [{ title: "Users", path: "/app/user-stories/index.md" }],
        },
      ],
    },
    {
      title: "Storage",
      path: "/storage/index.md",
      entries: [{ title: "Deep", path: "/app/deep/thing.md" }],
    },
    { title: "Root", path: "/root/index.md", entries: [{ path: "/top.md" }] },
  ],
};

describe("normalise", () => {
  it("drops a trailing index.md", () => {
    assert.equal(normalise("/app/index.md"), "/app/");
    assert.equal(normalise("/app/"), "/app/");
    assert.equal(normalise("/app/tenets.md"), "/app/tenets.md");
  });
});

describe("openSection matches encoded browser pathnames to manifest paths", () => {
  /** Each manifest path, written raw and encoded, against the pathname the browser reports. */
  const CASES = [
    ["ascii", "/guide/sub/page.md", "/guide/sub/page.md"],
    ["index.md", "/guide/sub/index.md", "/guide/sub/"],
    ["space", "/guide/my docs/my page.md", "/guide/my%20docs/my%20page.md"],
    ["reserved", "/guide/a#b?c/d#e.md", "/guide/a%23b%3Fc/d%23e.md"],
    ["unicode", "/guide/café/naïve.md", "/guide/caf%C3%A9/na%C3%AFve.md"],
  ];
  for (const [name, raw, browser] of CASES) {
    for (const [form, path] of [
      ["raw", raw],
      ["encoded", browser],
    ]) {
      it(`${name}, manifest ${form}`, () => {
        // Section 0 holds the parent directory, so only a match on the entry picks section 1
        const m = {
          sections: [
            { path: "/guide/a.md" },
            { path: "/elsewhere.md", entries: [{ path }] },
          ],
        };
        // Exact entry match
        assert.equal(openSection(m, browser), 1);
        // Longest directory prefix: an unlisted page beside the entry
        const dir = browser.slice(0, browser.lastIndexOf("/") + 1);
        assert.equal(openSection(m, `${dir}unlisted.md`), 1);
        // aria-current compares the same normalised forms
        assert.equal(normalise(path), normalise(browser));
      });
    }
  }
  it("compares a path that does not decode as written", () => {
    assert.equal(normalise("/guide/100%.md"), "/guide/100%.md");
  });
});

describe("parse", () => {
  it("rejects what is not an object with sections[]", () => {
    for (const value of [null, 3, "x", [], {}, { sections: {} }]) {
      assert.equal(parse(value), null);
    }
  });

  it("keeps a well-formed manifest", () => {
    assert.equal(parse(manifest).sections.length, 3);
    assert.equal(openSection(parse(manifest), "/app/user-stories/"), 0);
  });

  it("drops a section or entry that is not an object, at both levels", () => {
    const parsed = parse({
      root: "Docs",
      sections: [
        null,
        {
          title: "App",
          path: "/app/index.md",
          entries: [
            7,
            {
              title: "Hub",
              path: "/app/hub.md",
              entries: [null, { path: "/app/n.md" }],
            },
          ],
        },
        { title: "No entries", path: "/x/index.md", entries: "nope" },
      ],
    });
    assert.equal(parsed.root, undefined);
    assert.equal(parsed.sections.length, 2);
    assert.deepEqual(parsed.sections[0].entries[0].entries, [
      { path: "/app/n.md" },
    ]);
    assert.equal(parsed.sections[1].entries, undefined);
    assert.equal(openSection(parsed, "/app/n.md"), 0);
    assert.equal(openSection(parsed, "/elsewhere/page.md"), -1);
  });
});

describe("openSection", () => {
  it("opens the section of an exact entry", () => {
    assert.equal(openSection(manifest, "/app/tenets.md"), 0);
    assert.equal(openSection(manifest, "/app/deep/thing.md"), 1);
  });

  it("matches a section's own page and a nested entry, with or without index.md", () => {
    assert.equal(openSection(manifest, "/storage/"), 1);
    assert.equal(openSection(manifest, "/app/user-stories/"), 0);
    assert.equal(openSection(manifest, "/app/user-stories/index.md"), 0);
  });

  it("falls back to the entry whose directory is the longest prefix", () => {
    assert.equal(openSection(manifest, "/app/other.md"), 0);
    assert.equal(openSection(manifest, "/app/deep/other.md"), 1);
    assert.equal(openSection(manifest, "/app/user-stories/s1.md"), 0);
  });

  it("opens nothing when no entry's directory holds the page", () => {
    assert.equal(openSection(manifest, "/elsewhere.md"), -1);
    assert.equal(openSection(manifest, "/"), -1);
  });
});
