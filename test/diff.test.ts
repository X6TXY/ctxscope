import assert from "node:assert/strict";

import { unifiedDiff } from "../src/diff.js";

const { test } = await import(`node:${"test"}`);

test("unifiedDiff returns empty string for identical content", () => {
  const content = "line 1\nline 2\nline 3";
  const result = unifiedDiff(content, content, "test.md");
  assert.equal(result, "");
});

test("unifiedDiff produces diff for added lines", () => {
  const before = "line 1\nline 2";
  const after = "line 1\nline 2\nline 3";
  const result = unifiedDiff(before, after, "test.md");
  assert.ok(result.includes("+line 3"));
  assert.ok(result.includes("--- a/test.md"));
  assert.ok(result.includes("+++ b/test.md"));
});

test("unifiedDiff produces diff for removed lines", () => {
  const before = "line 1\nline 2\nline 3";
  const after = "line 1\nline 3";
  const result = unifiedDiff(before, after, "test.md");
  assert.ok(result.includes("-line 2"));
});

test("unifiedDiff produces diff for modified lines", () => {
  const before = "line 1\nold text\nline 3";
  const after = "line 1\nnew text\nline 3";
  const result = unifiedDiff(before, after, "test.md");
  assert.ok(result.includes("-old text"));
  assert.ok(result.includes("+new text"));
});

test("unifiedDiff handles empty before", () => {
  const before = "";
  const after = "new line 1\nnew line 2";
  const result = unifiedDiff(before, after, "new.md");
  assert.ok(result.includes("+new line 1"));
  assert.ok(result.includes("+new line 2"));
});

test("unifiedDiff handles empty after", () => {
  const before = "line 1\nline 2";
  const after = "";
  const result = unifiedDiff(before, after, "gone.md");
  assert.ok(result.includes("-line 1"));
  assert.ok(result.includes("-line 2"));
});

test("unifiedDiff starts with file headers", () => {
  const result = unifiedDiff("a", "b", "file.md");
  assert.ok(result.startsWith("--- a/file.md"));
  assert.ok(result.includes("+++ b/file.md"));
});
