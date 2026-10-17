/**
 * The search box, shown when the content root has a `search.json`: a serialized MiniSearch
 * index with the options it was built with and the options to query it with.
 *
 * Search is opt-in by evidence and fails closed. Before the first keystroke nothing but the
 * root listing is read; on it the file is fetched and checked, and only then is MiniSearch
 * loaded from the CDN. Any failure disables the box with one `console.warn`; nothing throws
 * out of this module. Ranking, fields, prefix and fuzzy settings are the file's, never ours.
 */

import { addScript, pathHref, rootFiles } from "./util.js";
import { minisearch } from "./cdn-scripts.js";

/** The MiniSearch major version a `search.json` must have: the one in the pinned CDN URL. */
export const MAJOR = Number(/minisearch@(\d+)\./.exec(minisearch.src)[1]);

/** How many results the list shows. */
export const LIMIT = 20;

/**
 * @typedef {{ engine: "minisearch", minisearch: string, options: object,
 *   searchOptions: object, index: object }} SearchFile
 * @typedef {{ id: string, title?: string, section?: string|null }} Result
 */

/**
 * Why `file` cannot be searched, or null when it can.
 *
 * @param {unknown} file  The parsed `search.json`.
 * @returns {string|null}
 */
export function check(file) {
  if (!file || typeof file !== "object" || Array.isArray(file)) {
    return "search.json is not an object";
  }
  if (file.engine !== "minisearch") {
    return `search.json is for engine ${JSON.stringify(file.engine)}, not "minisearch"`;
  }
  const version = file.minisearch;
  const major =
    typeof version === "string" ? Number(version.split(".")[0]) : NaN;
  if (major !== MAJOR) {
    return `search.json was built with minisearch ${JSON.stringify(version)}, not major ${MAJOR}`;
  }
  for (const key of ["options", "searchOptions", "index"]) {
    if (!file[key] || typeof file[key] !== "object") {
      return `search.json has no "${key}"`;
    }
  }
  return null;
}

/**
 * Whether the content root has a `search.json`, from the root listing alone.
 *
 * @returns {Promise<boolean>}
 */
export async function probe() {
  return (await rootFiles()).has("search.json");
}

/**
 * Fetch and check `search.json`, load MiniSearch and the index.
 *
 * @returns {Promise<{ index: any, searchOptions: object }>}  Rejects with the reason.
 */
async function load() {
  let text;
  try {
    const response = await fetch("/src:/search.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    text = await response.text();
  } catch (err) {
    throw new Error(`cannot fetch search.json: ${err.message}`);
  }
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error("search.json is not valid JSON");
  }
  const reason = check(file);
  if (reason) throw new Error(reason);
  try {
    await addScript(minisearch);
  } catch {
    throw new Error(`cannot load ${minisearch.src}`);
  }
  if (typeof window.MiniSearch?.loadJS !== "function") {
    throw new Error("MiniSearch did not load");
  }
  try {
    const index = window.MiniSearch.loadJS(file.index, file.options);
    return { index, searchOptions: file.searchOptions };
  } catch (err) {
    throw new Error(`cannot load the index: ${err.message}`);
  }
}

/**
 * @param {Result} result
 * @returns {HTMLLIElement}
 */
function item(result) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = pathHref(String(result.id));
  a.textContent = result.title || result.id;
  li.appendChild(a);
  if (result.section) {
    const section = document.createElement("small");
    section.className = "search-section";
    section.textContent = result.section;
    li.append(" ", section);
  }
  return li;
}

/**
 * The search box and its result list.
 *
 * @returns {HTMLElement}
 */
export function render() {
  const container = document.createElement("div");
  container.className = "search";
  container.setAttribute("role", "search");

  const box = document.createElement("input");
  box.type = "search";
  box.className = "search-box";
  box.placeholder = "Search";
  box.setAttribute("aria-label", "Search");
  box.autocomplete = "off";

  const results = document.createElement("ul");
  results.className = "search-results";
  results.hidden = true;

  container.append(box, results);

  /** @type {Promise<{ index: any, searchOptions: object }>|null} */
  let loading = null;

  const clear = () => {
    results.replaceChildren();
    results.hidden = true;
  };

  /** @param {string} reason */
  const disable = (reason) => {
    console.warn(`[up-doc] search unavailable: ${reason}`);
    clear();
    box.value = "";
    box.disabled = true;
    box.placeholder = "search unavailable";
  };

  const update = async () => {
    if (!box.value.trim()) {
      clear();
      return;
    }
    loading ??= load();
    let engine;
    try {
      engine = await loading;
    } catch (err) {
      if (!box.disabled) disable(err.message);
      return;
    }
    // The box may have changed while the index loaded: search what it holds now
    const query = box.value.trim();
    if (box.disabled || !query) {
      clear();
      return;
    }
    let found;
    try {
      found = engine.index.search(query, engine.searchOptions);
    } catch (err) {
      disable(`search failed: ${err.message}`);
      return;
    }
    results.replaceChildren(...found.slice(0, LIMIT).map(item));
    results.hidden = results.children.length === 0;
  };

  box.addEventListener("input", update);
  box.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      box.value = "";
      clear();
    } else if (event.key === "Enter") {
      const first = results.querySelector("a");
      if (first) window.location.href = first.href;
    }
  });
  return container;
}
