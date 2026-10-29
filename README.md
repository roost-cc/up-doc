# up-doc

Markdown and OpenAPI documentation server with client-side rendering. Serves any
directory of markdown files as a browsable documentation site with live rendering,
syntax highlighting, Mermaid diagrams, Vega-Lite charts, and OpenAPI spec viewing.

## Quick Start

```bash
npm install
node docserver.js
```

This serves the current working directory on port 8080. Open
`http://localhost:8080/` to browse your markdown files.

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
`Last-Modified` header of its source).

## Tests

```bash
npm test
```

Runs the unit tests (`node --test test/unit/*.test.js`), then the Playwright viewer tests
(`test/e2e/`), which start `node docserver.js` on each fixture root under `test/fixtures/`.
Playwright needs its Chromium installed (`npx playwright install chromium`). The fixtures'
`search.json` files are built from their pages by `node test/fixtures/build-search.js`; a unit
test fails when one is out of date.

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
npm run check -- [--doc-dir <path>] [--skip-file <path>] [--skip <regex>]
```

Starts the doc-server on a free ephemeral port, runs the crawler against it,
and tears the server down. `DOC_DIR` defaults to the current working
directory (matching `node docserver.js`); pass `--doc-dir` or set the
`DOC_DIR` env var to override.

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
still checked.

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
and are served at the `/_/` prefix. See [`web/README.md`](web/README.md) for
details on the rendering plugins and architecture.
