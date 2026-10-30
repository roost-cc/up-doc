# up-doc

Markdown and OpenAPI documentation server with client-side rendering. Serves any
directory of markdown files as a browsable documentation site with live rendering,
syntax highlighting, Mermaid diagrams, Vega-Lite charts, and OpenAPI spec viewing.

## Quick Start

```bash
npm install @roost-cc/up-doc
npx up-doc
```

This serves the current working directory on port 8080. Open
`http://localhost:8080/` to browse your markdown files. From a checkout, `npm install` and
`node docserver.js` do the same.

The `up-doc` command takes a subcommand:

| Command                                            | What it does                                     |
| -------------------------------------------------- | ------------------------------------------------ |
| `up-doc`                                           | Start the server                                 |
| `up-doc build-static --doc-dir <root> --out <dir>` | Write a [static site](#static-site)              |
| `up-doc check [flags]`                             | Run the [link checker](#link-checker) (one-shot) |

Anything else prints usage and exits non-zero.

## Configuration

Configuration uses a 3-tier priority system (higher wins):

### 1. Environment Variables

| Variable   | Description                         | Default    |
| ---------- | ----------------------------------- | ---------- |
| `DOC_DIR`  | Content directory to serve          | `.` (cwd)  |
| `DOC_PORT` | Port to listen on                   | `8080`     |
| `DOC_USER` | HTTP Basic Auth username (optional) | _disabled_ |
| `DOC_PASS` | HTTP Basic Auth password (optional) | _disabled_ |

### 2. Config File

Place a `config.json` in the working directory:

```json
{
  "port": 8080,
  "directory": "./docs"
}
```

### 3. Built-in Defaults

Port `8080`, directory `.` (cwd), auth disabled.

## Examples

Serve a specific directory on a custom port:

```bash
DOC_DIR=./my-docs DOC_PORT=3000 node docserver.js
```

Enable HTTP Basic Auth:

```bash
DOC_USER=admin DOC_PASS=secret node docserver.js
```

## Sidebar: `site.json`

A content root may hold a `site.json` describing its navigation. When it is there, every
page shows a sidebar built from it; when it is missing, or is not an object with a
`sections` array, the viewer shows no sidebar and behaves as if the file did not exist.

```json
{
  "root": { "title": "Handbook" },
  "sections": [
    {
      "title": "Guide",
      "path": "/guide/index.md",
      "entries": [
        { "title": "Getting started", "path": "/guide/start.md" },
        {
          "title": "Reference",
          "path": "/guide/reference.md",
          "entries": [{ "title": "Options", "path": "/guide/ref/options.md" }]
        }
      ]
    }
  ]
}
```

- `root.title` heads the sidebar and links `/`.
- Each of `sections` is a collapsible group: its `title` links its `path`, and its
  `entries` are listed under it.
- An entry is `{ title, path }`. An entry may carry its own `entries` (a hub), listed under
  it; deeper nesting is not rendered.
- Paths are root-relative file paths as written, not URL-encoded: `/guide/my page.md`, and
  `/guide/a%20b.md` names a file with a literal `%20`. `/guide/` and `/guide/index.md` are the
  same page.
- Other fields (a `blurb`, an `id`) are ignored.

The entry for the current page is marked `aria-current="page"` and its section is open. A
page that is no entry opens the section of the entry whose directory is the longest prefix
of the page's path (the root directory `/` does not count); otherwise every section is
closed. Under 800px the sidebar hides behind a "Menu" button.

## Search: `search.json`

A content root may hold a `search.json`: a serialized [MiniSearch](https://lucaong.github.io/minisearch/)
index of its pages, built by whatever builds the content. When it is there, the viewer shows
a search box (at the head of the sidebar, or at the top of the page without one) and searches
in the browser; up-doc never builds or changes the index.

```json
{
  "engine": "minisearch",
  "minisearch": "7.2.0",
  "options": {
    "fields": ["title", "headings", "text"],
    "storeFields": ["title", "section"]
  },
  "searchOptions": { "prefix": true, "fuzzy": 0.2 },
  "index": {}
}
```

- `engine` is `"minisearch"`.
- `minisearch` is the version that built the index. Its major must equal the major of the
  MiniSearch build up-doc loads (`web/cdn-scripts.js`, currently 7).
- `options` are the options the index was built with, passed to `MiniSearch.loadJS`.
- `searchOptions` are passed unchanged to every `search(query, searchOptions)`: ranking,
  boosts, prefix and fuzzy matching are the file's to choose.
- `index` is `MiniSearch#toJSON()`.

A document's `id` is the root-relative file path of its page as written, not URL-encoded
(`/guide/start.md`); the result list
shows its stored `title` and, in small text, its stored `section` when it has one. Up to twenty
results are listed; Enter opens the first, Escape clears the box.

Before the first keystroke the viewer only checks the root listing for the file. On the first
keystroke it fetches and checks `search.json`, then loads MiniSearch from the CDN. A file
another tool wrote (another `engine`, another major, a missing field, malformed JSON), a
failed fetch or a blocked script logs one `console.warn` and disables the box with the
placeholder "search unavailable"; the page is unaffected.

## Rendered fences

A fenced code block is drawn by its language:

- ` ```mermaid `: a [Mermaid](https://mermaid.js.org/) diagram.
- ` ```vega-lite `: a chart. The block holds one [Vega-Lite](https://vega.github.io/vega-lite/)
  v5 spec as JSON, drawn as SVG by `vega-embed` in Vega's `dark` theme while
  `prefers-color-scheme: dark` matches, and drawn again when the scheme changes. A spec with
  `width: "container"` fills the content column. A block that is not JSON or not a valid
  spec shows its source under a one-line error. The Vega scripts load only on a page with
  such a fence.
- Any other language: syntax-highlighted code.

## Updated line

Every markdown page also shows an "Updated" line with the file's modification date (the
`Last-Modified` header of its source). On a static host that header is the upload time, see
[below](#static-site).

## Static site

`up-doc build-static` turns a documentation root into a tree any static host can serve, with no
running server. The viewer still loads its libraries from public CDNs (`web/cdn-scripts.js`).

```bash
npx up-doc build-static --doc-dir ./docs --out ./site
```

Both flags are required. The layout is the same one the server answers:

| Path                     | What it holds                                                    |
| ------------------------ | ---------------------------------------------------------------- |
| `/_/`                    | The viewer: `web/*.js`, `*.css`, `*.html`                        |
| `/_/src/<path>`          | Every content file                                               |
| `/_/ls/<dir>/index.json` | One JSON listing per directory (`/_/ls/index.json` for the root) |

Dot-files and dot-directories are left out at every depth, and the server does not serve them
either. Copied files keep their modification time and symlinks are followed.

The build writes nothing and exits non-zero when `--out` exists and is not empty, when `--out` is
`--doc-dir` or inside it, when the root has a top-level `_` entry (`/_/` is reserved), when a
content directory is named `index.json` (its parent's listing needs that path), or on a broken
symlink. It also fails, leaving nothing, if a symlink moves `--doc-dir` or `--out` while it runs.
The tree is built beside `--out` and renamed onto it as the last step, so `--out` gets the whole
tree or nothing and a failed build can simply run again. That needs the parent of `--out` to be
writable and on the same file system, so `--out` cannot be a mount point.

### The rewrite rule

A person opening `/guide/a.md` gets the viewer, and the viewer fetches the same file's markdown
from `/_/src/guide/a.md`, so a host needs one rewrite in front of the tree. It ships as
`static/rewrite.cjs`, and `docserver.js` routes through the same function, so both answer every
URL alike:

| Request                                | Object          |
| -------------------------------------- | --------------- |
| `/_/*`                                 | unchanged       |
| a path ending in `/`, `.md` or `.json` | `/_/index.html` |
| a path whose last segment has no `.`   | `/_/index.html` |
| anything else                          | `/_/src<path>`  |

The rule works on the percent-encoded path and never decodes it. Resolving a path to a directory,
its index file or a raw file is the viewer's job, done from the listings, so the host needs no
directory handling and may answer a missing object with 403 or 404. A dotted directory without a
slash (`/v1.2`) cannot be told from a file: it goes to the raw object, which is missing.

### Deploying

The file runs unchanged as a CloudFront Function. For S3 behind CloudFront:

1. Create a function with the `cloudfront-js-2.0` runtime, with the contents of
   `node_modules/@roost-cc/up-doc/static/rewrite.cjs` as its code.
2. Associate it with the distribution's default behaviour as a viewer request function.
3. Upload the tree:

   ```bash
   aws s3 sync ./site s3://<bucket> --delete
   ```

Any other host needs to run the same rule before its object lookup. `rewriteUri(uri)` is the
package's one export:

```js
import { rewriteUri } from '@roost-cc/up-doc/static/rewrite.cjs';
```

The "Updated" line reads `Last-Modified`, which S3 sets at upload rather than from the file. The
build keeps modification times so `aws s3 sync` uploads only what changed, so the date is the
deploy that carried the change, and on a first deploy every page shows that deploy's date.

## Release

A release is a hand-run `npm publish` by a maintainer with 2FA on the npm account, from a clean
checkout of this repository. It needs nothing outside it.

1. Run the tests from a clean checkout:

   ```bash
   npm ci
   npx playwright install chromium
   npm test
   ```

2. Bump the version, which commits and tags it:

   ```bash
   npm version <patch|minor|major>
   ```

3. Publish:

   ```bash
   npm publish --access public
   ```

## Tests

```bash
npm test
```

Runs the unit tests (`node --test test/unit/*.test.js`), then the Playwright viewer tests
(`test/e2e/`). Every spec runs twice: in the `docserver` project against `node docserver.js` on
each fixture root under `test/fixtures/`, and in the `static` project against a `build-static`
tree of the same root behind `test/static-server.js`. That server has no route but `rewriteUri`
and answers a missing object with 403, as S3 behind Origin Access Control does, so the viewer is
proved not to depend on a 404. Playwright needs its Chromium installed
(`npx playwright install chromium`). Each CDN URL is fetched once per run and answered from
`test-results/cdn-cache/` after that. The fixtures' `search.json` files are built from their pages
by `node test/fixtures/build-search.js`; a unit test fails when one is out of date.

Formatting (prettier), file hygiene and the secrets scan run as [pre-commit](https://pre-commit.com)
hooks: `pre-commit install`, or `pre-commit run --all-files` by hand. `test/fixtures/` is
excluded, since some fixtures are malformed on purpose.

## Docker

```bash
docker build -t up-doc .
docker run -p 8080:8080 -v /path/to/docs:/docs -e DOC_DIR=/docs up-doc
```

## Link Checker

### One-shot

```bash
up-doc check [--doc-dir <path>] [--skip-file <path>] [--skip <regex>]
```

Starts the doc-server on a free ephemeral port, runs the crawler against it,
and tears the server down. `DOC_DIR` defaults to the current working
directory (matching `node docserver.js`); pass `--doc-dir` or set the
`DOC_DIR` env var to override. From a checkout, `npm run check -- <flags>`
does the same.

### Crawler-only

```bash
npm run check-links -- [base-url] [--skip-file <path>] [--skip <regex>]
```

Use against an already-running server — for example the docker docs
container at `http://localhost:8082` (the default base URL). This is the
flow for CI or Docker setups that run the server separately.

### What is checked

Every markdown link and image target that points into the site is checked;
`http` links, `mailto:` and `data:` URLs are not fetched. Link syntax inside
fenced code blocks (backtick or tilde fences) and inline code spans is not
checked either, so examples can show it without being reported as broken.
Indented (four-space) code blocks are not recognised: links inside them are
still checked. The crawler reads through `/_/src/` and `/_/ls/`; a link to a
directory resolves through its listing and passes only if it holds an index
file (`index.md`, `INDEX.md`, `index.html`, or those names in any case).

### Skip-file format

One ECMAScript regex per line, matched (case-sensitive) against the resolved
URL path of each candidate link. Matches are treated as OK: not fetched, not
crawled. Lines beginning with `#` and blank lines are ignored.

```text
# Generated JSDoc — only present after `pnpm docs`
^/api/jsdoc/

# OpenAPI spec
^/api/openapi\.json$

# Coverage reports
^/reports/coverage/
```

### Exit codes

- `0` — all links resolve
- `1` — broken links found, the server failed to start, or an IO error
  occurred

## SPA Architecture

The server uses a client-side SPA for rendering. Static assets live in `web/`
and are served at the `/_/` prefix, with raw content at `/_/src/` and directory
listings at `/_/ls/`. See [`web/README.md`](web/README.md) for details on the
rendering plugins and architecture.
