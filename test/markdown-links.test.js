import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  extractLinks,
  stripCode,
  stripCodeSpans,
  stripFencedCode,
} from "../scripts/markdown-links.js";

const PLACEHOLDER = "![](charts/<name>.svg)";

describe("extractLinks: fenced code blocks", () => {
  it("ignores a ``` fence and keeps prose links around it", () => {
    const text = [
      "See [before](before.md).",
      "```",
      PLACEHOLDER,
      "[inside](inside.md)",
      "```",
      "See [after](after.md).",
    ].join("\n");
    assert.deepEqual(extractLinks(text), ["before.md", "after.md"]);
  });

  it("ignores a ~~~ fence", () => {
    const text = [
      "[before](before.md)",
      "~~~",
      PLACEHOLDER,
      "~~~",
      "[after](after.md)",
    ].join("\n");
    assert.deepEqual(extractLinks(text), ["before.md", "after.md"]);
  });

  it("does not close a four-backtick fence with a three-backtick line", () => {
    const text = [
      "````",
      "```",
      "[inner](inner.md)",
      "```",
      "[still inside](still.md)",
      "````",
      "[after](after.md)",
    ].join("\n");
    assert.deepEqual(extractLinks(text), ["after.md"]);
  });

  it("lets an unclosed fence run to the end of the document", () => {
    const text = [
      "[before](before.md)",
      "```",
      "[inside](inside.md)",
      "",
      "[never reported](no.md)",
    ].join("\n");
    assert.deepEqual(extractLinks(text), ["before.md"]);
  });

  it("ignores a fence with an info string", () => {
    const text = ["```js", "[x](y.md)", "```", "[after](after.md)"].join("\n");
    assert.deepEqual(extractLinks(text), ["after.md"]);
  });

  it("treats a backtick fence whose info string has a backtick as text", () => {
    // Line 1 is not a fence, so its backticks are left to the span pass and
    // the link on line 2 is reported; the ``` on line 3 then opens a real
    // fence that runs to the end of the text.
    const text = ["``` a`b", "[x](y.md)", "```", "[after](after.md)"].join(
      "\n",
    );
    assert.deepEqual(extractLinks(text), ["y.md"]);
    assert.deepEqual(extractLinks("``` a`b [x](y.md)"), ["y.md"]);
  });

  it("allows backticks in a tilde fence's info string", () => {
    const text = ["~~~ a`b", "[x](y.md)", "~~~", "[after](after.md)"].join(
      "\n",
    );
    assert.deepEqual(extractLinks(text), ["after.md"]);
  });

  it("closes on a fence with trailing whitespace", () => {
    const text = ["```", "[x](y.md)", "```   ", "[after](after.md)"].join("\n");
    assert.deepEqual(extractLinks(text), ["after.md"]);
  });

  it("closes on a longer fence of the same character", () => {
    const text = ["```", "[x](y.md)", "`````", "[after](after.md)"].join("\n");
    assert.deepEqual(extractLinks(text), ["after.md"]);
  });

  it("does not close a backtick fence with a tilde fence", () => {
    const text = ["```", "[x](y.md)", "~~~", "[inside](inside.md)"].join("\n");
    assert.deepEqual(extractLinks(text), []);
  });

  it("ignores a fence inside a blockquote", () => {
    const text = [
      "> ```",
      `> ${PLACEHOLDER}`,
      "> ```",
      "> [quoted](quoted.md)",
    ].join("\n");
    assert.deepEqual(extractLinks(text), ["quoted.md"]);
  });

  it("ignores a fence inside a list item indented three spaces", () => {
    const text = [
      "1. Item",
      "   ```",
      `   ${PLACEHOLDER}`,
      "   ```",
      "   [listed](listed.md)",
    ].join("\n");
    assert.deepEqual(extractLinks(text), ["listed.md"]);
  });

  it("preserves the line count when blanking a fence", () => {
    const text = "a\n```\nb\n```\nc";
    assert.equal(stripFencedCode(text), "a\n\n\n\nc");
  });

  it("does not let a backtick in a fence open a span across the fence", () => {
    const text = ["```", "`", "```", "[after](after.md) `", "[x](y.md)"].join(
      "\n",
    );
    assert.deepEqual(extractLinks(text), ["after.md", "y.md"]);
  });
});

describe("extractLinks: inline code spans", () => {
  it("ignores a single-backtick span but reports a broken link beside it", () => {
    const text = `The report embeds \`![t](charts/<name>.svg)\` and [real](missing.md).`;
    assert.deepEqual(extractLinks(text), ["missing.md"]);
  });

  it("ignores a double-backtick span containing a backtick", () => {
    const text = "`` a ` b [x](y.md) ``";
    assert.deepEqual(extractLinks(text), []);
  });

  it("treats an unclosed backtick run as literal text", () => {
    assert.deepEqual(extractLinks("a lone ` then [x](y.md)"), ["y.md"]);
  });

  it("keeps a run of two with no closing run of two as text", () => {
    assert.deepEqual(extractLinks("a``b [x](y.md)"), ["y.md"]);
    assert.equal(stripCodeSpans("a``b"), "a``b");
  });

  it("closes a span across lines", () => {
    const text = "`[x](y.md)\n[z](z.md)` [after](after.md)";
    assert.deepEqual(extractLinks(text), ["after.md"]);
  });

  it("replaces a span with a space so neighbours do not fuse", () => {
    assert.equal(stripCodeSpans("[a`b`](c.md)"), "[a ](c.md)");
    assert.deepEqual(extractLinks("[`x`](`y`.md)"), []);
  });
});

describe("extractLinks: ordinary links", () => {
  it("reports links in prose, lists, tables and blockquotes", () => {
    const text = [
      "Prose [a](a.md).",
      "- list [b](b.md)",
      "| cell | [c](c.md) |",
      "> quote [d](d.md)",
    ].join("\n");
    assert.deepEqual(extractLinks(text), ["a.md", "b.md", "c.md", "d.md"]);
  });

  it("drops fragments and keeps images, in document order", () => {
    const text = "![img](pic.png) [doc](doc.md#section) [frag](#only)";
    assert.deepEqual(extractLinks(text), ["pic.png", "doc.md"]);
  });

  it("stripCode strips fences then spans", () => {
    const text = "x `a` y\n```\nz\n```\n`b`";
    assert.equal(stripCode(text), "x   y\n\n\n\n ");
  });
});
