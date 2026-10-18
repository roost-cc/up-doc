/**
 * Write `search.json` for the fixture roots that have one (`search/`, `site/`): a MiniSearch
 * index of every `.md` page, in the shape the viewer reads (`engine`, `minisearch`, `options`,
 * `searchOptions`, `index`). Run after changing a page: `node test/fixtures/build-search.js`.
 *
 * A document is `{ id, section, title, headings, text }`: `id` the root-relative path,
 * `section` the page's top directory (null at the root), `title` its first heading, `headings`
 * the others and `text` the rest of the body.
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import MiniSearch from "minisearch";

const FIXTURES = path.dirname(fileURLToPath(import.meta.url));

/** The fixture roots that carry a `search.json` built from their pages. */
export const ROOTS = ["search", "site"];

const OPTIONS = {
  fields: ["title", "headings", "text"],
  storeFields: ["title", "section", "headings"],
};

const SEARCH_OPTIONS = {
  boost: { title: 3, headings: 2 },
  prefix: true,
  fuzzy: 0.2,
};

/** The installed `minisearch` version, from its `package.json`. */
function version() {
  const require = createRequire(import.meta.url);
  let dir = path.dirname(require.resolve("minisearch"));
  while (!fs.existsSync(path.join(dir, "package.json")))
    dir = path.dirname(dir);
  return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"))
    .version;
}

/** @param {string} dir  @returns {string[]} root-relative `.md` paths, sorted */
function pages(dir, rel = "") {
  return fs
    .readdirSync(path.join(dir, rel), { withFileTypes: true })
    .flatMap((e) => {
      const p = path.posix.join(rel, e.name);
      if (e.isDirectory()) return pages(dir, p);
      return e.name.endsWith(".md") ? [p] : [];
    })
    .sort();
}

/** @param {string} markdown */
function extract(markdown) {
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
  const headings = [];
  const text = [];
  let fenced = false;
  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) headings.push(h[1].trim());
    else text.push(line);
  }
  return {
    title: headings.shift() ?? null,
    headings,
    text: text.join(" ").replace(/\s+/g, " ").trim(),
  };
}

/**
 * The `search.json` content for a fixture root.
 *
 * @param {string} root  A directory name under `test/fixtures/`.
 * @returns {string}
 */
export function build(root) {
  const dir = path.join(FIXTURES, root);
  const documents = pages(dir).map((rel) => {
    const { title, headings, text } = extract(
      fs.readFileSync(path.join(dir, rel), "utf8"),
    );
    const top = rel.includes("/") ? rel.split("/")[0] : null;
    return { id: `/${rel}`, section: top, title: title ?? rel, headings, text };
  });
  const index = new MiniSearch(OPTIONS);
  index.addAll(documents);
  return (
    JSON.stringify({
      engine: "minisearch",
      minisearch: version(),
      options: OPTIONS,
      searchOptions: SEARCH_OPTIONS,
      index: index.toJSON(),
    }) + "\n"
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const root of ROOTS) {
    fs.writeFileSync(path.join(FIXTURES, root, "search.json"), build(root));
  }
}
