#!/usr/bin/env node

/**
 * The `up-doc` command. Each subcommand's module parses its own arguments, so the subcommand
 * leaves `process.argv` first.
 */

const USAGE = `Usage:
  up-doc                                       Start the documentation server
  up-doc build-static --doc-dir <root> --out <dir>
                                               Write a static site
  up-doc check [--doc-dir <path>] [--skip-file <path>] [--skip <regex>]...
                                               Check the site's links`;

const SUBCOMMANDS = new Map([
  ['build-static', '../static/build.js'],
  ['check', '../scripts/check.js'],
]);

const [subcommand] = process.argv.splice(2, 1);
const module = subcommand === undefined ? '../docserver.js' : SUBCOMMANDS.get(subcommand);

if (module) {
  await import(module);
} else {
  console.error(USAGE);
  process.exitCode = 1;
}
