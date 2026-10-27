/** CDN script and stylesheet definitions — single source of truth for URLs, versions, and SRI hashes. */

export const highlightjs = {
  src: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js',
  integrity: 'sha512-EBLzUL8XLl+va/zAsmXwS7Z2B1F9HUHkZwyS/VKwh3S7T/U0nF4BaU29EP/ZSf6zgiIxYAnKLu6bJ8dqpmX5uw==',
  crossorigin: 'anonymous',
  referrerpolicy: 'no-referrer',
};

export const mermaid = {
  src: 'https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.12.0/mermaid.min.js',
  integrity: 'sha512-5TKaYvhenABhlGIKSxAWLFJBZCSQw7HTV7aL1dJcBokM/+3PNtfgJFlv8E6Us/B1VMlQ4u8sPzjudL9TEQ06ww==',
  crossorigin: 'anonymous',
  referrerpolicy: 'no-referrer',
};

export const pako = {
  src: 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js',
  integrity: 'sha512-g2TeAWw5GPnX7z0Kn8nFbYfeHcvAu/tx6d6mrLe/90mkCxO+RcptyYpksUz35EO337F83bZwcmUyHiHamspkfg==',
  crossorigin: 'anonymous',
  referrerpolicy: 'no-referrer',
};

export const markdownit = {
  src: 'https://cdn.jsdelivr.net/npm/markdown-it@13/dist/markdown-it.min.js',
  integrity: 'sha512-ohlWmsCxOu0bph1om5eDL0jm/83eH09fvqLDhiEdiqfDeJbEvz4FSbeY0gLJSVJwQAp0laRhTXbUQG+ZUuifUQ==',
  crossorigin: 'anonymous',
  referrerpolicy: 'no-referrer',
};

export const scalar = {
  src: 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.50.0/dist/browser/standalone.min.js',
  integrity: 'sha512-Zg4K2TkQ8/MW5f387urMY/QK+h/tnqHQJSWtGe5xi73W/5vqCJeeAYSwyeRhiMqKttxonpb/q19M0BOJpehTYA==',
  crossorigin: 'anonymous',
  referrerpolicy: 'no-referrer',
};

/** The search engine; the major version in this URL is the one a `search.json` must match. */
export const minisearch = {
  src: 'https://cdn.jsdelivr.net/npm/minisearch@7.2.0/dist/umd/index.js',
  integrity: 'sha384-KuHy7eg9MqWBVrMXJC0WN6q4d3+KBquZ3Htgex79A4REptrDvGOXfAgZ0VOJ1Mdx',
  crossorigin: 'anonymous',
  referrerpolicy: 'no-referrer',
};

/**
 * The Vega-Lite chart renderer: `vega`, then `vega-lite` and `vega-embed`, which read the
 * globals the earlier ones set, so they load in this order. Vega-Lite 5 reads the v5 specs
 * `bl report` writes; vega-embed 6 bundles the themes (`dark`) and the tooltip handler.
 */
export const vega = {
  src: 'https://cdn.jsdelivr.net/npm/vega@5.33.1/build/vega.min.js',
  integrity: 'sha512-+GViBV02lldi4aBOR8OWMdGu5ApqARUG69Bkh0hNnEwGRqWbqBFV6UFMkOSw6bwVeLAUCfXDjvogYHc6vMTV9w==',
  crossorigin: 'anonymous',
  referrerpolicy: 'no-referrer',
};

export const vegaLite = {
  src: 'https://cdn.jsdelivr.net/npm/vega-lite@5.23.0/build/vega-lite.min.js',
  integrity: 'sha512-dT3pPQcxzshiv0WnkUzBS6BMECn95uEVvIdofdO4jNg8rSlDqeuMyvEUvZ8Xbr8jQwIItKnzBi0F/B00burNcQ==',
  crossorigin: 'anonymous',
  referrerpolicy: 'no-referrer',
};

export const vegaEmbed = {
  src: 'https://cdn.jsdelivr.net/npm/vega-embed@6.29.0/build/vega-embed.min.js',
  integrity: 'sha512-0RVfLKHWgepeHYozLLj5rxH2Kr18r+QQQY3XgGqJQjY+F52nsAWAe8drSYWksApUy6F5GizX7sXuZu8rxmzpbw==',
  crossorigin: 'anonymous',
  referrerpolicy: 'no-referrer',
};

export const asciinema_script = {
  src: 'https://cdn.jsdelivr.net/npm/asciinema-player@3.12.1/dist/bundle/asciinema-player.min.js',
  integrity: 'sha256-VoS8wUKbD63rWOmKvq3G0RYrbWAeVrTCbF5vl1qWXBw=',
  crossorigin: 'anonymous',
  referrerpolicy: 'no-referrer',
};

export const asciinema_css = {
  href: 'https://cdn.jsdelivr.net/npm/asciinema-player@3.12.1/dist/bundle/asciinema-player.min.css',
};
