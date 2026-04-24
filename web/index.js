import * as markdown from "./markdown.js";
import { MermaidRenderer } from "./mermaid.js";
import { AsciinemaRenderer } from "./asciinema.js";
import * as modal from "./modal.js";
import * as openapi from "./openapi.js";
import { addScript } from "./util.js";
import { highlightjs } from "./cdn-scripts.js";

function buildBreadcrumbs(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  // Strip trailing index filenames from breadcrumb display
  const last = segments[segments.length - 1];
  if (last && /^index\.(md|html)$/i.test(last)) segments.pop();

  const nav = document.createElement("nav");
  nav.className = "breadcrumbs";

  if (segments.length === 0) {
    // At root — just show "docs" as plain text
    nav.appendChild(document.createTextNode("docs"));
    return nav;
  }

  // Root link
  const root = document.createElement("a");
  root.href = "/";
  root.textContent = "docs";
  nav.appendChild(root);

  // Intermediate segments are directory links
  let href = "/";
  for (let i = 0; i < segments.length - 1; i++) {
    nav.appendChild(document.createTextNode(" / "));
    href += segments[i] + "/";
    const link = document.createElement("a");
    link.href = href;
    link.textContent = segments[i];
    nav.appendChild(link);
  }

  // Final segment is plain text (current page/directory)
  nav.appendChild(document.createTextNode(" / "));
  const current = document.createElement("span");
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
    this.contentType = null;
    this.jsonContent = null;
  }

  async init() {
    await this.load();

    if (this.contentType === "directory") return;

    if (this.contentType === "openapi") {
      await openapi.init();
      return;
    }

    if (this.contentType === "json") {
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
    if (this.contentType === "directory") {
      await this.renderDirectoryListing();
      return;
    }

    if (this.contentType === "openapi") {
      await this.renderOpenApi();
      return;
    }

    if (this.contentType === "json") {
      await this.renderJson();
      return;
    }

    // markdown
    let body = this.markdown;
    let frontmatterHtml = "";

    // Parse YAML frontmatter (--- ... ---) and render as a table
    const fmMatch = body.match(/^---\n([\s\S]*?)\n---\n*/);
    if (fmMatch) {
      body = body.slice(fmMatch[0].length);
      const rows = fmMatch[1]
        .split("\n")
        .filter((line) => line.includes(":"))
        .map((line) => {
          const idx = line.indexOf(":");
          const key = line.slice(0, idx).trim();
          const value = line.slice(idx + 1).trim();
          return `<tr><th>${key}</th><td>${value}</td></tr>`;
        })
        .join("");
      if (rows) frontmatterHtml = `<table class="frontmatter">${rows}</table>`;
    }

    this.html = frontmatterHtml + this.md.render(body);
    this.element.innerHTML = this.html;
    this.element.insertBefore(
      buildBreadcrumbs(window.location.pathname),
      this.element.firstChild,
    );
    modal.addModal(this.element);
    for (const plugin of this.plugins) {
      await plugin.render(this);
    }
  }

  async renderOpenApi() {
    document.body.classList.add("openapi-view");
    this.element.innerHTML = "";
    this.element.appendChild(buildBreadcrumbs(window.location.pathname));

    const container = document.createElement("div");
    container.id = "openapi-container";
    this.element.appendChild(container);

    openapi.render(container, this.jsonContent);
  }

  async renderJson() {
    this.element.innerHTML = "";
    this.element.appendChild(buildBreadcrumbs(window.location.pathname));

    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-json";
    code.textContent = this.jsonContent;
    pre.appendChild(code);
    this.element.appendChild(pre);

    /* global hljs */
    hljs.highlightElement(code);
  }

  async renderDirectoryListing() {
    const response = await fetch(`/ls:${this.directoryPath}`);
    if (!response.ok) {
      this.element.innerHTML =
        '<div class="error">Failed to load directory listing</div>';
      return;
    }

    const entries = await response.json();

    // Build breadcrumbs
    const nav = buildBreadcrumbs(this.directoryPath);

    // Build listing
    const listing = document.createElement("ul");
    listing.className = "directory-listing";

    if (entries.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "This directory is empty";
      listing.appendChild(empty);
    } else {
      for (const entry of entries) {
        const li = document.createElement("li");
        li.className = entry.type;
        const a = document.createElement("a");
        a.href =
          this.directoryPath + entry.name + (entry.type === "dir" ? "/" : "");
        a.textContent = entry.name + (entry.type === "dir" ? "/" : "");
        li.appendChild(a);
        listing.appendChild(li);
      }
    }

    this.element.innerHTML = "";
    this.element.appendChild(nav);
    this.element.appendChild(listing);
  }

  // Load content from URL
  async load() {
    try {
      const pathname = window.location.pathname;

      if (pathname.endsWith(".md")) {
        this.path = pathname;
        this.contentType = "markdown";
      } else if (pathname.endsWith("/")) {
        this.path = pathname;
        this.contentType = "markdown"; // may become 'directory' on 404
      } else if (pathname.endsWith(".json")) {
        this.path = pathname;
        this.contentType = "json"; // may become 'openapi' after parse
      } else {
        throw new Error("Unsupported file type");
      }

      const response = await fetch(`/src:${this.path}`);

      if (!response.ok) {
        if (response.status === 404 && pathname.endsWith("/")) {
          this.directoryPath = pathname;
          this.contentType = "directory";
          return;
        }
        if (response.status === 404) {
          throw new Error(`File not found: ${this.path}`);
        }
        throw new Error(`Failed to load ${this.path}`);
      }

      if (this.contentType === "json") {
        this.jsonContent = await response.text();
        try {
          const parsed = JSON.parse(this.jsonContent);
          if (parsed && parsed.openapi) {
            this.contentType = "openapi";
          }
        } catch {
          // malformed JSON — will display as plain text
        }
      } else {
        this.markdown = await response.text();
      }
    } catch (error) {
      console.error("Error loading file:", error);
      document.body.innerHTML = `<div class="error">Error loading file: ${error.message}</div>`;
    }
  }
}

// Set up initialization when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const markdownRenderer = new MarkdownRenderer(
      document.body,
      new MermaidRenderer(),
      new AsciinemaRenderer(),
    );
    await markdownRenderer.init();
    await markdownRenderer.render();
  } catch (err) {
    console.error("[up-doc] render failed:", err);
  }
});
