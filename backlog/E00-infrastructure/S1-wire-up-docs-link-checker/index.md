---
epic: E00 · Infrastructure
story_id: S-1
title: Wire up docs link checker
type: chore
points: 2
status: backlog
added: 2026-04-04
---

# S-1 · Wire up docs link checker

## Summary

`scripts/check-links.js` crawls links via HTTP, so it requires a running doc-server instance.
There is currently no single command that starts the server, runs the link checker against it,
and reports results. The checker also needs to handle generated-content links (JSDoc, OpenAPI
specs, test reports) that may not exist yet — either by building them first or by maintaining a
documented skip list.

## Acceptance Criteria

- [ ] A single command (or documented `npm` script) starts up-doc, runs the link checker
      against it, and reports broken links.
- [ ] Generated-content links (JSDoc, coverage, OpenAPI, test reports) are either present
      before the check or excluded with a documented skip list.
- [ ] The process works from a clean state (no prior build artifacts).
- [ ] `README.md` documents how to run the link checker.

## Design Notes

The link checker targets any running doc-server instance via its HTTP endpoint. The default
base URL is `http://localhost:8082` (configurable via CLI argument). When run as part of a
CI or Docker workflow, the consumer repo (e.g. app.roost.cc) is responsible for building
generated content before starting the server.

## Implementation Plan

1. Add an `npm` script (e.g. `check-links`) that starts the server in the background, runs
   `scripts/check-links.js`, and shuts the server down afterward.
2. Handle generated-content 404s — either accept a skip-list file or document that content
   must be built before running the checker.
3. Update `README.md` with link-checker usage instructions.

## Justification

The link checker exists but has no ergonomic way to run end-to-end. Without this, broken
links in hosted documentation go undetected until someone manually starts the server and
runs the script.

## Dependencies

None.
