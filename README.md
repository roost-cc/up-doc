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

Crawl a running doc-server instance and verify all markdown links resolve:

```bash
node scripts/check-links.js [base-url]
```

Default base URL is `http://localhost:8082`.

## SPA Architecture

The server uses a client-side SPA for rendering. Static assets live in `web/`
and are served at the `/_/` prefix. See [`web/README.md`](web/README.md) for
details on the rendering plugins and architecture.
