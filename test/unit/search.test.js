import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MAJOR, check } from "../../web/search.js";
import { ROOTS, build } from "../fixtures/build-search.js";

const fixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
);

const good = {
  engine: "minisearch",
  minisearch: "7.2.0",
  options: { fields: ["title"] },
  searchOptions: {},
  index: {},
};

describe("MAJOR", () => {
  it("is the major of the pinned CDN URL", () => {
    assert.equal(MAJOR, 7);
  });
});

describe("check", () => {
  it("accepts a MiniSearch file of the pinned major", () => {
    assert.equal(check(good), null);
  });

  it("rejects what is not an object", () => {
    for (const file of [null, 3, "x", []]) assert.match(check(file), /object/);
  });

  it("rejects another engine", () => {
    assert.match(check({ ...good, engine: "lunr" }), /"lunr"/);
  });

  it("rejects another major or no version", () => {
    assert.match(check({ ...good, minisearch: "6.3.0" }), /"6\.3\.0"/);
    assert.match(check({ ...good, minisearch: undefined }), /major 7/);
  });

  it("rejects a file missing options, searchOptions or index", () => {
    for (const key of ["options", "searchOptions", "index"]) {
      const file = { ...good };
      delete file[key];
      assert.match(check(file), new RegExp(`"${key}"`));
    }
  });
});

describe("fixture search.json", () => {
  for (const root of ROOTS) {
    it(`${root}/search.json is rebuilt from its pages`, () => {
      const committed = fs.readFileSync(
        path.join(fixtures, root, "search.json"),
        "utf8",
      );
      assert.equal(
        committed,
        build(root),
        "run node test/fixtures/build-search.js",
      );
    });
  }
});
