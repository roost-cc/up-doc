# Routes

The viewer is served at `/_/` and reads everything through two paths, built by `srcUrl` and
`listingUrl` in `util.js`. They are the same on `docserver.js` and on a static host behind
`static/rewrite.cjs`:

- `/_/src/<path>`: a content file's raw bytes. Exactly that file; a directory is not an object.
- `/_/ls/<dir>/index.json`: a directory's listing (`/_/ls/index.json` for the root), fetched once
  per directory per page by `listing()`.

`load()` in `index.js` resolves the page's path from those, so nothing depends on how a host
answers for a missing object:

- A path ending `/` reads that directory's listing and fetches the index file `indexName()` picks.
  With none it renders the directory listing from what it already fetched.
- A path with no extension reads its parent's listing: a directory replaces the location with
  `<path>/`, a file replaces it with `/_/src<path>`, and anything else shows "File not found".
- `*.md` and `*.json` are fetched directly.

# Rendering

Rendering markdown to HTML in a 2 step process. First the each plugin is initalized, where
during the plugin configures the markdown-it (`md`) engine to render "normal" html. For
example the mermaid renderer configures `md` to render mermaid blocks to a `<pre>` element.  
Then after the markdown has been rendered to HTML, the plugin `render` method can process
that HTML into more complex structures, such as an SVG.

The mermaid renderer sets the fence rule, which highlights every language it does not draw.
The Vega-Lite renderer (`vega-lite.js`) comes after it in the plugin list and wraps that rule:
a `vega-lite` fence becomes a `<div class="vega-lite">` holding the encoded source, and every
other fence goes on to the mermaid rule. Its `render` draws each placeholder with `vegaEmbed`,
or replaces it with the source under a one-line error, and a `matchMedia` listener draws the
charts again when `prefers-color-scheme` changes.
