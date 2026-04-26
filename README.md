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
