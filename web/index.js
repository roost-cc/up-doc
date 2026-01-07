/* global mermaid, markdownit, pako */

import * as markdown from './markdown.js';
import { MermaidRenderer } from './mermaid.js';
import { AsciinemaRenderer } from './asciinema.js';
import * as modal from './modal.js';

export class MarkdownRenderer {
  constructor(element, ...plugins) {
    this.element = element;
    this.plugins = plugins;
    this.md = null;
    this.path = null;
    this.markdown = null;
    this.html = null;
  }

  async init() {
    await this.load();
    await markdown.init(this);
    this.md = await markdown.getMarkdownEngine();
    for (const plugin of this.plugins) {
      await plugin.init(this);
    }
  }

  async render() {
    this.html = this.md.render(this.markdown);
    this.element.innerHTML = this.html;
    modal.addModal(this.element);
    for (const plugin of this.plugins) {
      await plugin.render(this);
    }
  }

  // Load markdown file from URL or default to INDEX.md
  async load() {
    try {
      if (window.location.pathname.endsWith('.md')) {
        this.path = window.location.pathname;
      }
      if (!this.path && window.location.pathname.endsWith('/')) {
        this.path = 'INDEX.md';
      }

      if (!this.path) {
        throw new Error('No markdown file found');
      }

      // don't send the referer when fetching the markdown file
      const response = await fetch(`/src:${this.path}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`File not found: ${this.path}`);
        }
        throw new Error(`Failed to load ${this.path}`);
      }

      this.markdown = await response.text();
    } catch (error) {
      console.error('Error loading markdown file:', error);
      document.body.innerHTML = `<div class="error">Error loading markdown file: ${error.message}</div>`;
    }
  }
}

// Store class documentation mapping

let docsLoaded = false;

// Render mermaid diagrams
// Render markdown and mermaid diagrams

// Set up initialization when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  //const markdownRenderer = new MarkdownRenderer(document.body, new MermaidRenderer(), new AsciinemaRenderer());
  const markdownRenderer = new MarkdownRenderer(document.body, new MermaidRenderer(), new AsciinemaRenderer());
  await markdownRenderer.init();
  await markdownRenderer.render();
});
