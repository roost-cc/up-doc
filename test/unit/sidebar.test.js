import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { current, normalise, openSection, parse } from "../../web/sidebar.js";
import { pathHref } from "../../web/util.js";

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

/**
 * Each case is a manifest path (the file path as written) and the pathname the browser reports
 * for it. The entry sits as a section, an entry and a nested entry; section 0 holds the parent
 * directory, so only a match on the case's own path picks section 1.
 *
 * @param {[string, string, string][]} cases  `[name, manifest path, browser pathname]`
 */
function pathCases(cases) {
  const at = {
    section: (path) => ({ path }),
    entry: (path) => ({ path: "/elsewhere.md", entries: [{ path }] }),
    nested: (path) => ({
      path: "/elsewhere.md",
      entries: [{ path: "/elsewhere/hub.md", entries: [{ path }] }],
    }),
  };
  for (const [name, raw, browser] of cases) {
    for (const [position, place] of Object.entries(at)) {
      it(`${name}, as ${position}`, () => {
        const m = { sections: [{ path: "/guide/a.md" }, place(raw)] };
        // The link's href lands on this pathname
        const landed = new URL(pathHref(raw), "http://host").pathname;
        assert.equal(current(landed), current(browser));
        // Exact match
        assert.equal(openSection(m, browser), 1);
        // Longest directory prefix: an unlisted page beside the entry
        const dir = browser.slice(0, browser.lastIndexOf("/") + 1);
        assert.equal(openSection(m, `${dir}unlisted.md`), 1);
        // aria-current compares the same forms
        assert.equal(normalise(raw), current(browser));
      });
    }
  }
}

describe("openSection matches encoded browser pathnames to manifest paths", () => {
  pathCases([
    ["ascii", "/guide/sub/page.md", "/guide/sub/page.md"],
    ["index.md", "/guide/sub/index.md", "/guide/sub/"],
    ["space", "/guide/my docs/my page.md", "/guide/my%20docs/my%20page.md"],
    ["reserved", "/guide/a#b?c/d#e.md", "/guide/a%23b%3Fc/d%23e.md"],
    ["unicode", "/guide/café/naïve.md", "/guide/caf%C3%A9/na%C3%AFve.md"],
  ]);
  it("compares a path that does not decode as written", () => {
    assert.equal(current("/guide/100%.md"), "/guide/100%.md");
  });
});

describe("openSection matches literal percent-escape filenames in raw manifests to double-encoded browser pathnames", () => {
  const LITERAL = [
    ["%20", "/guide/sub/a%20b.md", "/guide/sub/a%2520b.md"],
    ["%23", "/guide/sub/a%23b.md", "/guide/sub/a%2523b.md"],
    ["%3F", "/guide/sub/a%3Fb.md", "/guide/sub/a%253Fb.md"],
    ["%2F", "/guide/sub/a%2Fb.md", "/guide/sub/a%252Fb.md"],
    ["%5C", "/guide/sub/a%5Cb.md", "/guide/sub/a%255Cb.md"],
    ["UTF-8 bytes", "/guide/sub/caf%C3%A9.md", "/guide/sub/caf%25C3%25A9.md"],
    ["directory", "/guide/d%20ir/page.md", "/guide/d%2520ir/page.md"],
  ];
  pathCases(LITERAL);
  it("does not treat the decoded lookalike as the same page", () => {
    for (const [, raw] of LITERAL) {
      // The browser pathname `raw` names the file with the escape decoded: another page
      assert.notEqual(current(raw), normalise(raw), raw);
    }
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
