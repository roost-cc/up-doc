# Claude Instructions — up-doc

## Language and Style

- **JavaScript only** — no TypeScript. JSDoc for type hints.
- ESM modules throughout (`"type": "module"` in package.json).

## Architecture

- Entry: `node docserver.js` — serves markdown via client-side SPA
- Config: env vars (`DOC_DIR`, `DOC_PORT`, `DOC_USER`, `DOC_PASS`) > `config.json` > defaults
- SPA assets: `web/` directory, served at `/_/` prefix
- Link checker: `scripts/check-links.js`
