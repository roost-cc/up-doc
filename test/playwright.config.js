import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

import { FIXTURES, STATIC_PORT_OFFSET } from './e2e/fixtures.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fixtures = Object.entries(FIXTURES);

/**
 * Every spec runs on both hosts: one `node docserver.js` per fixture root under `test/fixtures/`,
 * and one `build-static` tree of it behind `test/static-server.js`.
 */
export default defineConfig({
  testDir: 'e2e',
  outputDir: '../test-results',
  fullyParallel: true,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'] },
  projects: [
    { name: 'docserver', metadata: { portOffset: 0 } },
    { name: 'static', metadata: { portOffset: STATIC_PORT_OFFSET } },
  ],
  webServer: [
    ...fixtures.map(([name, port]) => ({
      command: 'node docserver.js',
      cwd: repoRoot,
      env: {
        DOC_DIR: path.join('test', 'fixtures', name),
        DOC_PORT: String(port),
      },
      url: `http://localhost:${port}/_/index.html`,
      reuseExistingServer: false,
      stdout: /** @type {const} */ ('ignore'),
    })),
    ...fixtures.map(([name, port]) => ({
      command: `node test/static-server.js ${name} ${port + STATIC_PORT_OFFSET}`,
      cwd: repoRoot,
      url: `http://localhost:${port + STATIC_PORT_OFFSET}/_/index.html`,
      reuseExistingServer: false,
      stdout: /** @type {const} */ ('ignore'),
    })),
  ],
});
