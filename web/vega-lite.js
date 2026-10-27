/* global vegaEmbed, hljs */
import { addScript } from './util.js';
import { MarkdownRenderer } from './index.js';
import { vega as vega_cdn, vegaLite as vegaLite_cdn, vegaEmbed as vegaEmbed_cdn } from './cdn-scripts.js';

/** The query `index.css` switches its dark colours on. */
const DARK = '(prefers-color-scheme: dark)';

/**
 * Draws ` ```vega-lite ` fences (a Vega-Lite spec as JSON) as SVG charts with vega-embed, in
 * Vega's `dark` theme while the page is dark. It knows the format only, nothing about who
 * wrote the spec.
 */
export class VegaLiteRenderer {
  constructor() {
    this.initialized = false;
    this.renderer = null;
    /** @type {{ element: HTMLElement, spec: object, result: any }[]} */
    this.charts = [];
  }

  /**
   * Wraps the fence rule the plugins before it set (the mermaid renderer's, which highlights
   * every other fence), so every language dispatches from one rule. It must come after the
   * mermaid renderer in the plugin list.
   * @param {MarkdownRenderer} renderer
   */
  async init(renderer) {
    this.renderer = renderer;
    const fence = renderer.md.renderer.rules.fence;
    renderer.md.renderer.rules.fence = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      if (token.info.trim() !== 'vega-lite') {
        return fence(tokens, idx, options, env, self);
      }
      const code = token.content.trim();
      return `<div class="vega-lite" data-source="${encodeURIComponent(code)}"></div>`;
    };

    // The scripts are about 800 kB, so only a page with a chart loads them. Ask the parser, so
    // a fence in a blockquote or list counts the same as the fence rule sees it
    const tokens = renderer.md.parse(renderer.markdown ?? '', {});
    if (tokens.some((t) => t.type === 'fence' && t.info.trim() === 'vega-lite')) {
      // vega-lite and vega-embed read the globals the scripts before them set
      await addScript(vega_cdn);
      await addScript(vegaLite_cdn);
      await addScript(vegaEmbed_cdn);
      window.matchMedia(DARK).addEventListener('change', () => this.redraw());
    }
    this.initialized = true;
  }

  /**
   * Draw every chart placeholder, or replace it with its source and a one-line error when the
   * block is not JSON or not a valid spec.
   */
  async render() {
    if (!this.initialized) {
      throw new Error('VegaLiteRenderer not initialized');
    }
    const placeholders = [...this.renderer.element.querySelectorAll('div.vega-lite')];
    this.charts = [];
    await Promise.all(
      placeholders.map(async (element) => {
        const source = decodeURIComponent(element.getAttribute('data-source'));
        try {
          const spec = JSON.parse(source);
          const chart = { element, spec, result: null };
          chart.result = await this.embed(element, spec);
          this.charts.push(chart);
        } catch (error) {
          console.error('Vega-Lite rendering failed:', error);
          element.replaceWith(fallback(source, error));
        }
      }),
    );
  }

  /**
   * @param {HTMLElement} element
   * @param {object} spec
   */
  embed(element, spec) {
    const dark = window.matchMedia(DARK).matches;
    return vegaEmbed(element, spec, {
      // The fence names the format, so a spec without `$schema` is not read as Vega
      mode: 'vega-lite',
      renderer: 'svg',
      actions: false,
      // The page's own background shows through in either theme
      config: { background: 'transparent' },
      ...(dark ? { theme: 'dark' } : {}),
    });
  }

  /** Draw every chart again in the scheme that now applies. */
  async redraw() {
    await Promise.all(
      this.charts.map(async (chart) => {
        chart.result?.finalize();
        chart.element.replaceChildren();
        chart.result = await this.embed(chart.element, chart.spec);
      }),
    );
  }
}

/**
 * The block's source as a code block, under a one-line error.
 * @param {string} source
 * @param {Error} error
 * @returns {HTMLElement}
 */
function fallback(source, error) {
  const container = document.createElement('div');
  container.className = 'vega-lite-invalid';

  const message = document.createElement('p');
  message.className = 'error';
  message.textContent = `Vega-Lite chart not drawn: ${error.message.split('\n')[0]}`;

  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.className = 'hljs';
  if (typeof hljs !== 'undefined' && hljs.getLanguage('json')) {
    code.innerHTML = hljs.highlight(source, { language: 'json' }).value;
  } else {
    code.textContent = source;
  }
  pre.appendChild(code);

  container.append(message, pre);
  return container;
}
