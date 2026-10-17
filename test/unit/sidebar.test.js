import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normalise, openSection } from "../../web/sidebar.js";

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
