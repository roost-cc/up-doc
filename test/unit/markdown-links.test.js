import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  extractLinks,
  stripCode,
  stripCodeSpans,
  stripFencedCode,
} from "../../scripts/markdown-links.js";

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

  it("handles CRLF line endings on fence lines", () => {
    const text = [
      "[before](before.md)",
      "```js",
      PLACEHOLDER,
      "```",
      "[after](after.md)",
    ].join("\r\n");
    assert.deepEqual(extractLinks(text), ["before.md", "after.md"]);
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

describe("extractLinks: lines that look like fences but are not", () => {
  const link = "[ordinary](ordinary.md)";

  // A line indented four or more columns (a tab counts as four) is indented
  // code, not a fence: it must neither open a fence nor hand its backticks
  // to the span pass. Paired and unpaired delimiters of both characters, with
  // every indent class and inside a blockquote. Expectations were checked
  // against markdown-it, the SPA's renderer.
  const cases = [
    ["four-space backticks, paired", `    \`\`\`\n${link}\n    \`\`\``],
    ["four-space backticks, unpaired", `    \`\`\`\n${link}`],
    ["four-space tildes, paired", `    ~~~\n${link}\n    ~~~`],
    ["four-space tildes, unpaired", `    ~~~\n${link}`],
    ["tab backticks, paired", `\t\`\`\`\n${link}\n\t\`\`\``],
    ["tab backticks, unpaired", `\t\`\`\`\n${link}`],
    ["tab tildes, paired", `\t~~~\n${link}\n\t~~~`],
    ["tab tildes, unpaired", `\t~~~\n${link}`],
    ["spaces then tab, backticks", `  \t\`\`\`\n${link}\n  \t\`\`\``],
    ["four-space longer backtick run", `    \`\`\`\`\n${link}\n    \`\`\`\``],
    ["four-space backticks with info", `    \`\`\`js\n${link}\n    \`\`\``],
    ["indented in a blockquote", `>     \`\`\`\n> ${link}\n>     \`\`\``],
    ["rejected backtick opener, unpaired", `\`\`\` a\`b\n${link}\n\`\`\``],
  ];

  it("extractLinks checks prose between non-fence delimiter lines", () => {
    for (const [name, text] of cases) {
      assert.deepEqual(extractLinks(text), ["ordinary.md"], name);
    }
  });

  // A rejected fence-like line is indented code, which is still checked: only
  // its run is neutralised, so a link elsewhere on the line is reported and
  // the prose after it is untouched. Every indent class, both characters,
  // empty and nonempty info strings, a lone line and a pair of them.
  const same = "[same](same.md)";
  const after = "[after](after.md)";
  const lineCases = [
    ["four-space backticks", `    \`\`\` ${same}`],
    ["four-space tildes", `    ~~~ ${same}`],
    ["tab backticks", `\t\`\`\` ${same}`],
    ["tab tildes", `\t~~~ ${same}`],
    ["spaces then tab, backticks", `  \t\`\`\` ${same}`],
    ["spaces then tab, tildes", `  \t~~~ ${same}`],
    ["blockquote plus four spaces, backticks", `>     \`\`\` ${same}`],
    ["blockquote plus four spaces, tildes", `>     ~~~ ${same}`],
    ["four-space longer backtick run", `    \`\`\`\` ${same}`],
    ["four-space backticks with info string", `    \`\`\`js ${same}`],
    ["four-space tildes with info string", `    ~~~js ${same}`],
  ];

  it("extractLinks includes links on indented fence-shaped lines", () => {
    for (const [name, line] of lineCases) {
      assert.deepEqual(
        extractLinks(`${line}\n${after}`),
        ["same.md", "after.md"],
        name,
      );
      assert.deepEqual(
        extractLinks(`${line}\n${after}\n${line}`),
        ["same.md", "after.md", "same.md"],
        `${name}, paired`,
      );
    }
    assert.equal(stripFencedCode("    ``` [a](x.md)"), "      [a](x.md)");
  });

  it("still treats a tab after a blockquote marker as a fence", () => {
    assert.deepEqual(extractLinks(`>\t\`\`\`\n> ${link}\n>\t\`\`\``), []);
  });

  it("lets a rejected backtick opener's run open a span, as the renderer does", () => {
    // Neither line is a fence (the info string holds a backtick), so the two
    // runs of three form one code span across the link; markdown-it renders
    // no link here.
    assert.deepEqual(extractLinks(`\`\`\` a\`b\n${link}\n\`\`\` a\`b`), []);
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
