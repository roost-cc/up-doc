import * as markdown from './markdown.js';
import { MermaidRenderer } from './mermaid.js';
import { VegaLiteRenderer } from './vega-lite.js';
import { AsciinemaRenderer } from './asciinema.js';
import * as modal from './modal.js';
import * as openapi from './openapi.js';
import { addScript, indexName, listing, srcUrl } from './util.js';
import { highlightjs } from './cdn-scripts.js';
import * as sidebar from './sidebar.js';
import * as search from './search.js';

function buildBreadcrumbs(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  // Strip trailing index filenames from breadcrumb display
  const last = segments[segments.length - 1];
  if (last && /^index\.(md|html)$/i.test(last)) segments.pop();

  const nav = document.createElement('nav');
  nav.className = 'breadcrumbs';

  if (segments.length === 0) {
    // At root — just show "docs" as plain text
    nav.appendChild(document.createTextNode('docs'));
    return nav;
  }

  // Root link
  const root = document.createElement('a');
  root.href = '/';
  root.textContent = 'docs';
  nav.appendChild(root);

  // Intermediate segments are directory links
  let href = '/';
  for (let i = 0; i < segments.length - 1; i++) {
    nav.appendChild(document.createTextNode(' / '));
    href += segments[i] + '/';
    const link = document.createElement('a');
    link.href = href;
    link.textContent = segments[i];
    nav.appendChild(link);
  }

  // Final segment is plain text (current page/directory)
  nav.appendChild(document.createTextNode(' / '));
  const current = document.createElement('span');
  current.textContent = segments[segments.length - 1];
  nav.appendChild(current);

  return nav;
}

export class MarkdownRenderer {
  constructor(element, ...plugins) {
    this.element = element;
    this.plugins = plugins;
    this.md = null;
    this.path = null;
    this.markdown = null;
    this.html = null;
    this.directoryPath = null;
    this.directoryEntries = null;
    this.contentType = null;
    this.jsonContent = null;
    this.lastModified = null;
  }

  async init() {
    await this.load();

    if (this.contentType === 'redirect' || this.contentType === 'directory') return;

    if (this.contentType === 'openapi') {
      await openapi.init();
      return;
    }

    if (this.contentType === 'json') {
      await addScript(highlightjs);
      return;
    }

    // markdown
    await markdown.init(this);
    this.md = await markdown.getMarkdownEngine();
    for (const plugin of this.plugins) {
      await plugin.init(this);
    }
  }

  async render() {
    if (this.contentType === 'redirect') return;

    if (this.contentType === 'directory') {
      await this.renderDirectoryListing();
      return;
    }

    if (this.contentType === 'openapi') {
      await this.renderOpenApi();
      return;
    }

    if (this.contentType === 'json') {
      await this.renderJson();
      return;
    }

    // markdown
    let body = this.markdown;
    let frontmatterHtml = '';

    // Parse YAML frontmatter (--- ... ---) and render as a table
    const fmMatch = body.match(/^---\n([\s\S]*?)\n---\n*/);
    if (fmMatch) {
      body = body.slice(fmMatch[0].length);
      const rows = fmMatch[1]
        .split('\n')
        .filter((line) => line.includes(':'))
        .map((line) => {
          const idx = line.indexOf(':');
          const key = line.slice(0, idx).trim();
          const value = line.slice(idx + 1).trim();
          return `<tr><th>${key}</th><td>${value}</td></tr>`;
        })
        .join('');
      if (rows) frontmatterHtml = `<table class="frontmatter">${rows}</table>`;
    }

    this.html = frontmatterHtml + this.md.render(body);
    this.element.innerHTML = this.html;
    this.insertUpdated();
    this.element.insertBefore(buildBreadcrumbs(window.location.pathname), this.element.firstChild);
    modal.addModal(this.element);
    for (const plugin of this.plugins) {
      await plugin.render(this);
    }
  }

  // "Updated <date>" from the Last-Modified header: after the first h1, else after the
  // frontmatter table, else at the top of the content
  insertUpdated() {
    if (!this.lastModified) return;
    const date = new Date(this.lastModified);
    if (Number.isNaN(date.getTime())) return;
    const line = document.createElement('p');
    line.className = 'updated';
    line.textContent = `Updated ${date.toLocaleDateString()}`;
    const after = this.element.querySelector(':scope > h1') ?? this.element.querySelector(':scope > table.frontmatter');
    if (after) after.after(line);
    else this.element.prepend(line);
  }

  async renderOpenApi() {
    document.body.classList.add('openapi-view');
    this.element.innerHTML = '';
    this.element.appendChild(buildBreadcrumbs(window.location.pathname));

    const container = document.createElement('div');
    container.id = 'openapi-container';
    this.element.appendChild(container);

    openapi.render(container, this.jsonContent);
  }

  async renderJson() {
    this.element.innerHTML = '';
    this.element.appendChild(buildBreadcrumbs(window.location.pathname));

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.className = 'language-json';
    code.textContent = this.jsonContent;
    pre.appendChild(code);
    this.element.appendChild(pre);

    /* global hljs */
    hljs.highlightElement(code);
  }

  async renderDirectoryListing() {
    const entries = this.directoryEntries;
    if (!entries) {
      this.element.innerHTML = '<div class="error">Failed to load directory listing</div>';
      return;
    }

    // Build breadcrumbs
    const nav = buildBreadcrumbs(this.directoryPath);

    // Build listing
    const listing = document.createElement('ul');
    listing.className = 'directory-listing';

    if (entries.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'This directory is empty';
      listing.appendChild(empty);
    } else {
      for (const entry of entries) {
        const li = document.createElement('li');
        li.className = entry.type;
        const a = document.createElement('a');
        a.href = this.directoryPath + encodeURIComponent(entry.name) + (entry.type === 'dir' ? '/' : '');
        a.textContent = entry.name + (entry.type === 'dir' ? '/' : '');
        li.appendChild(a);
        listing.appendChild(li);
      }
    }

    this.element.innerHTML = '';
    this.element.appendChild(nav);
    this.element.appendChild(listing);
  }

  // A path with no extension: its parent's listing says whether it is a directory or a file
  async resolveBarePath(pathname) {
    const slash = pathname.lastIndexOf('/');
    const name = decodeURIComponent(pathname.slice(slash + 1));
    const entries = await listing(pathname.slice(0, slash + 1));
    const entry = entries?.find((e) => e.name === name);
    if (!entry) throw new Error(`File not found: ${pathname}`);
    const { search, hash } = window.location;
    this.contentType = 'redirect';
    window.location.replace(entry.type === 'dir' ? `${pathname}/${search}${hash}` : srcUrl(pathname) + search + hash);
  }

  // Load content from URL
  async load() {
    try {
      const pathname = window.location.pathname;
      let source = pathname;

      if (pathname.endsWith('.md')) {
        this.path = pathname;
        this.contentType = 'markdown';
      } else if (pathname.endsWith('/')) {
        const entries = await listing(pathname);
        const index = entries && indexName(entries);
        if (!index) {
          this.directoryPath = pathname;
          this.directoryEntries = entries;
          this.contentType = 'directory';
          return;
        }
        this.path = pathname;
        this.contentType = 'markdown';
        source = pathname + encodeURIComponent(index);
      } else if (pathname.endsWith('.json')) {
        this.path = pathname;
        this.contentType = 'json'; // may become 'openapi' after parse
      } else if (!pathname.slice(pathname.lastIndexOf('/')).includes('.')) {
        await this.resolveBarePath(pathname);
        return;
      } else {
        throw new Error('Unsupported file type');
      }

      const response = await fetch(srcUrl(source));

      if (!response.ok) {
        // S3 behind Origin Access Control answers 403 for a missing object
        if (response.status === 404 || response.status === 403) {
          throw new Error(`File not found: ${this.path}`);
        }
        throw new Error(`Failed to load ${this.path}`);
      }

      if (this.contentType === 'json') {
        this.jsonContent = await response.text();
        try {
          const parsed = JSON.parse(this.jsonContent);
          if (parsed && parsed.openapi) {
            this.contentType = 'openapi';
          }
        } catch {
          // malformed JSON — will display as plain text
        }
      } else {
        this.markdown = await response.text();
        this.lastModified = response.headers.get('last-modified');
      }
    } catch (error) {
      console.error('Error loading file:', error);
      // Into the content column, so a missing page keeps the sidebar
      this.element.innerHTML = `<div class="error">Error loading file: ${error.message}</div>`;
    }
  }
}

// Set up initialization when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // With a site.json the content goes in a column beside the sidebar; without one the body
    // is the content, as it always was
    let content = document.body;
    const [manifest, searchable] = await Promise.all([sidebar.load(), search.probe()]);
    const box = searchable ? search.render() : null;
    if (manifest) {
      const nav = sidebar.render(manifest, window.location.pathname);
      // The search box heads the sidebar, under the root title
      if (box) nav.querySelector('.sidebar-root').after(box);
      content = document.createElement('main');
      content.className = 'content';
      document.body.append(sidebar.toggle(nav), nav, content);
      document.body.classList.add('has-sidebar');
    }
    const markdownRenderer = new MarkdownRenderer(
      content,
      new MermaidRenderer(),
      // After the mermaid renderer: it wraps the fence rule that one sets
      new VegaLiteRenderer(),
      new AsciinemaRenderer(),
    );
    await markdownRenderer.init();
    await markdownRenderer.render();
    // Without a sidebar the box goes at the top of the page, once the render has replaced it
    if (box && !manifest) document.body.prepend(box);
  } catch (err) {
    console.error('[up-doc] render failed:', err);
  }
});
