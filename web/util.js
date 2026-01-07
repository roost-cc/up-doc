/**
 *
 * @param {Object.<string, string>} attributes
 * @param {EventListener} listener
 */
export function addScript(attributes) {
  if (!attributes.src) {
    throw new Error('src is required');
  }
  // Check that the script is not already in the document
  if (document.querySelector(`script[src="${attributes.src}"]`)) return;

  const script = document.createElement('script');
  for (const [key, value] of Object.entries(attributes)) {
    script.setAttribute(key, value);
  }

  const promise = new Promise((resolve, reject) => {
    script.addEventListener('load', resolve);
    script.addEventListener('error', reject);
  });
  document.head.appendChild(script);
  return promise;
}

export function addCSSLink(attributes) {
  if (!attributes.href) {
    throw new Error('href is required');
  }
  const link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  for (const [key, value] of Object.entries(attributes)) {
    link.setAttribute(key, value);
  }

  const promise = new Promise((resolve, reject) => {
    link.addEventListener('load', resolve);
    link.addEventListener('error', reject);
  });
  document.head.appendChild(link);
  return promise;
}

/**
 *
 * @param {string} content
 * @param {string} subcontent
 * @returns {number} The line index of the first occurrence of subcontent in content, or -1 if not found
 */
export function lineIndexOf(content, subcontent) {
  const lines = content.split('\n');
  const sublines = subcontent.split('\n');
  let index = -1;

  let subi = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]; // Don't trim here

    if (line.trim() === sublines[subi].trim()) {
      // humans count from 1, so we add 1 to the index
      if (index === -1) index = i + 1;
      subi++;
      if (subi === sublines.length) return index;
      continue;
    }
    index = -1;
    subi = 0;
  }
  return index;
}
