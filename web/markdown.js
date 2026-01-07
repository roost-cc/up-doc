import { addScript } from './util.js';

const markdownit_attributes = {
  src: 'https://cdn.jsdelivr.net/npm/markdown-it@13/dist/markdown-it.min.js',
  integrity: 'sha512-ohlWmsCxOu0bph1om5eDL0jm/83eH09fvqLDhiEdiqfDeJbEvz4FSbeY0gLJSVJwQAp0laRhTXbUQG+ZUuifUQ==',
  crossorigin: 'anonymous',
  referrerpolicy: 'no-referrer',
};

const resolver = {};
const md_promise = new Promise((resolve, reject) => {
  resolver.resolve = resolve;
  resolver.reject = reject;
});

export async function getMarkdownEngine() {
  return md_promise;
}

export async function init(base = window.location.toString()) {
  await addScript(markdownit_attributes);
  const md = window.markdownit({
    html: true,
    linkify: true,
    typographer: true,
  });
  // Add anchor generation to headers
  md.renderer.rules.heading_open = function (tokens, idx, options, _env, self) {
    const token = tokens[idx];
    const title = tokens[idx + 1].content;
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    if (
      token.tag === 'h1' ||
      token.tag === 'h2' ||
      token.tag === 'h3' ||
      token.tag === 'h4' ||
      token.tag === 'h5' ||
      token.tag === 'h6'
    ) {
      return `<${token.tag} id="${slug}"><a class="header-anchor" href="#${slug}">#</a>`;
    }

    return self.renderToken(tokens, idx, options);
  };

  // Custom image renderer to handle relative image paths
  md.renderer.rules.image = function (tokens, idx, options, _env, self) {
    const token = tokens[idx];
    const srcIndex = token.attrIndex('src');
    if (srcIndex >= 0) {
      const src = token.attrs[srcIndex][1];

      token.attrs[srcIndex][1] = new URL(src, base).toString();
    }
    return self.renderToken(tokens, idx, options);
  };

  resolver.resolve(md);
}
