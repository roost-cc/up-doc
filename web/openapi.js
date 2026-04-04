import { addScript } from './util.js';
import { scalar } from './cdn-scripts.js';

export async function init() {
  await addScript(scalar);
}

export function render(container, jsonString) {
  const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const ref = window.Scalar.createApiReference(container, {
    content: jsonString,
    darkMode,
    hideDarkModeToggle: true,
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    ref.updateConfiguration({ darkMode: e.matches });
  });
}
