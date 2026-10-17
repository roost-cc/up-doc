# up-doc

Markdown and OpenAPI documentation server with client-side rendering. Serves any
directory of markdown files as a browsable documentation site with live rendering,
syntax highlighting, Mermaid diagrams, and OpenAPI spec viewing.

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
- Paths are root-relative. `/guide/` and `/guide/index.md` are the same page.
- Other fields (a `blurb`, an `id`) are ignored.

The entry for the current page is marked `aria-current="page"` and its section is open. A
page that is no entry opens the section of the entry whose directory is the longest prefix
of the page's path (the root directory `/` does not count); otherwise every section is
closed. Under 800px the sidebar hides behind a "Menu" button.

Every markdown page also shows an "Updated" line with the file's modification date (the
`Last-Modified` header of its source).

## Tests

```bash
npm test
```

Runs the unit tests (`node --test test/unit/*.test.js`), then the Playwright viewer tests
(`test/e2e/`), which start `node docserver.js` on each fixture root under `test/fixtures/`.
Playwright needs its Chromium installed (`npx playwright install chromium`).

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
flow used by CI / Docker setups in other Roost repos.

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
