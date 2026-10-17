/**
 * The sidebar, rendered from an optional `site.json` at the content root.
 *
 * The manifest is `{ root: { title }, sections: [{ title, path, entries: [...] }] }`; an entry is
 * `{ title, path }` and may carry its own `entries[]` (one nested level). Paths are
 * root-relative. Without a manifest there is no sidebar.
 */

/**
 * @typedef {{ title?: string, path?: string, entries?: Entry[] }} Entry
 * @typedef {{ title?: string, path?: string, entries?: Entry[] }} Section
 * @typedef {{ root?: { title?: string }, sections: Section[] }} Manifest
 */

/**
 * Fetch `/src:/site.json`. Anything but an object with `sections[]` is no manifest.
 *
 * @returns {Promise<Manifest|null>}
 */
export async function load() {
  try {
    // The directory listing answers for any root, so a root without the file costs no 404.
    const listing = await fetch("/ls:/");
    if (!listing.ok) return null;
    const names = await listing.json();
    if (!Array.isArray(names) || !names.some((e) => e?.name === "site.json")) {
      return null;
    }
    const response = await fetch("/src:/site.json");
    if (!response.ok) return null;
    const manifest = await response.json();
    if (
      !manifest ||
      typeof manifest !== "object" ||
      !Array.isArray(manifest.sections)
    ) {
      return null;
    }
    return manifest;
  } catch {
    return null;
  }
}

/**
 * A path with a trailing `index.md` dropped, so a directory and its index are the same page.
 *
 * @param {string} pathname
 * @returns {string}
 */
export function normalise(pathname) {
  return pathname.replace(/\/index\.md$/i, "/");
}

/** @param {string} pathname */
function directoryOf(pathname) {
  return pathname.slice(0, pathname.lastIndexOf("/") + 1);
}

/**
 * Every link target in a section: the section itself, its entries and their nested entries.
 *
 * @param {Section} section
 * @returns {string[]}
 */
function pathsOf(section) {
  const paths = [section.path];
  for (const entry of section.entries ?? []) {
    paths.push(entry.path);
    for (const nested of entry.entries ?? []) paths.push(nested.path);
  }
  return paths.filter((p) => typeof p === "string");
}

/**
 * Which section opens for `pathname`: the one holding an entry that is the page, else the one
 * holding the entry whose directory is the longest prefix of the page's path (the root
 * directory does not count), else none.
 *
 * @param {Manifest} manifest
 * @param {string} pathname
 * @returns {number}  The section's index, or -1.
 */
export function openSection(manifest, pathname) {
  const page = normalise(pathname);
  const exact = manifest.sections.findIndex((s) =>
    pathsOf(s).some((p) => normalise(p) === page),
  );
  if (exact !== -1) return exact;
  let best = -1;
  let bestLength = 1;
  manifest.sections.forEach((section, i) => {
    for (const p of pathsOf(section)) {
      const dir = directoryOf(normalise(p));
      if (dir.length > bestLength && page.startsWith(dir)) {
        best = i;
        bestLength = dir.length;
      }
    }
  });
  return best;
}

/**
 * @param {{ title?: string, path?: string }} item
 * @param {string} page  The normalised current path.
 * @returns {HTMLAnchorElement}
 */
function link(item, page) {
  const a = document.createElement("a");
  a.href = item.path ?? "#";
  a.textContent = item.title ?? item.path ?? "";
  if (typeof item.path === "string" && normalise(item.path) === page) {
    a.setAttribute("aria-current", "page");
  }
  return a;
}

/**
 * @param {Entry[]} entries
 * @param {string} page
 * @param {boolean} nest  Whether an entry's own `entries[]` render under it.
 * @returns {HTMLUListElement}
 */
function list(entries, page, nest) {
  const ul = document.createElement("ul");
  for (const entry of entries) {
    const li = document.createElement("li");
    li.appendChild(link(entry, page));
    if (nest && Array.isArray(entry.entries) && entry.entries.length) {
      li.appendChild(list(entry.entries, page, false));
    }
    ul.appendChild(li);
  }
  return ul;
}

/**
 * The sidebar for `pathname`.
 *
 * @param {Manifest} manifest
 * @param {string} pathname
 * @returns {HTMLElement}
 */
export function render(manifest, pathname) {
  const page = normalise(pathname);
  const nav = document.createElement("nav");
  nav.className = "sidebar";
  nav.id = "sidebar";
  nav.setAttribute("aria-label", "Site");

  const root = link({ title: manifest.root?.title ?? "Home", path: "/" }, page);
  root.className = "sidebar-root";
  nav.appendChild(root);

  const open = openSection(manifest, pathname);
  manifest.sections.forEach((section, i) => {
    const details = document.createElement("details");
    if (i === open) details.open = true;
    const summary = document.createElement("summary");
    summary.appendChild(link(section, page));
    details.appendChild(summary);
    if (Array.isArray(section.entries)) {
      details.appendChild(list(section.entries, page, true));
    }
    nav.appendChild(details);
  });
  return nav;
}

/**
 * The "Menu" button that shows the sidebar over the content on a narrow screen.
 *
 * @param {HTMLElement} nav
 * @returns {HTMLButtonElement}
 */
export function toggle(nav) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sidebar-toggle";
  button.textContent = "Menu";
  button.setAttribute("aria-controls", nav.id);
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(expanded));
    document.body.classList.toggle("sidebar-open", expanded);
  });
  return button;
}
