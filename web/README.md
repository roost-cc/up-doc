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
