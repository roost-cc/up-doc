import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

import { FIXTURES } from './e2e/fixtures.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** One `node docserver.js` per fixture root under `test/fixtures/`. */
export default defineConfig({
  testDir: 'e2e',
  outputDir: '../test-results',
  fullyParallel: true,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'] },
  webServer: Object.entries(FIXTURES).map(([name, port]) => ({
    command: 'node docserver.js',
    cwd: repoRoot,
    env: {
      DOC_DIR: path.join('test', 'fixtures', name),
      DOC_PORT: String(port),
    },
    url: `http://localhost:${port}/_/index.html`,
    reuseExistingServer: false,
    stdout: 'ignore',
  })),
});
