# Rendering

Rendering markdown to HTML in a 2 step process. First the each plugin is initalized, where
during the plugin configures the markdown-it (`md`) engine to render "normal" html. For
example the mermaid renderer configures `md` to render mermaid blocks to a `<pre>` element.  
Then after the markdown has been rendered to HTML, the plugin `render` method can process
that HTML into more complex structures, such as an SVG.
