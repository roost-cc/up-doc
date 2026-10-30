/**
 * The one request-rewrite rule of the up-doc layout, shared by docserver.js and static hosts.
 *
 *   /_/*                                    → unchanged (viewer, raw content, listings)
 *   a path ending in /, .md or .json        → /_/index.html (the viewer renders it)
 *   a path whose last segment has no `.`    → /_/index.html (the viewer resolves it)
 *   everything else                         → /_/src<uri> (the raw file)
 *
 * This file runs unchanged as a CloudFront Function (`cloudfront-js-2.0`): keep it a plain script
 * with no `import`, `export` or `require`, within that runtime's features. Node loads it through
 * the guard at the end.
 */

/**
 * The object path for a request path. `uri` stays percent-encoded: it is never decoded here.
 *
 * @param {string} uri
 * @returns {string}
 */
function rewriteUri(uri) {
  if (uri.startsWith('/_/')) return uri;
  const last = uri.slice(uri.lastIndexOf('/') + 1);
  if (uri.endsWith('/') || uri.endsWith('.md') || uri.endsWith('.json') || last.indexOf('.') === -1) {
    return '/_/index.html';
  }
  return '/_/src' + uri;
}

/**
 * The CloudFront Function entry point (viewer request).
 *
 * @param {{ request: { uri: string } }} event
 * @returns {{ uri: string }}
 */
function handler(event) {
  const request = event.request;
  request.uri = rewriteUri(request.uri);
  return request;
}

if (typeof module !== 'undefined') module.exports = { rewriteUri, handler };
