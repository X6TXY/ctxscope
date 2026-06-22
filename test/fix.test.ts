import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

import { DEFAULT_CONFIG } from "../src/config.js";
import { removeDuplicateParagraphs, runFix } from "../src/fix.js";

const { test } = await import(`node:${"test"}`);

const DUPLICATE_PARAGRAPH = "Repeat this exact paragraph because it is long enough to be considered duplicate context.";

test("fix dry-run reports safe fixes without writing files", () => {
  const root = makeFixture("fix-dry-run");
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }));
  writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  writeFileSync(join(root, "AGENTS.md"), [
    "# Agent instructions",
    "",
    "Run npm install and npm run test.",
    "",
    DUPLICATE_PARAGRAPH,
    "",
    DUPLICATE_PARAGRAPH,
  ].join("\n"));
  const before = readFileSync(join(root, "AGENTS.md"), "utf8");

  const result = runFix({ target: root, agent: "all", dryRun: true }, DEFAULT_CONFIG);
  const after = readFileSync(join(root, "AGENTS.md"), "utf8");

  assert.ok(result.applied.length > 0);
  assert.equal(after, before);
});

test("fix applies package manager normalization and duplicate paragraph removal", () => {
  const root = makeFixture("fix-write");
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }));
  writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  writeFileSync(join(root, "AGENTS.md"), [
    "# Agent instructions",
    "",
    "Run npm install and npm run test.",
    "",
    DUPLICATE_PARAGRAPH,
    "",
    DUPLICATE_PARAGRAPH,
  ].join("\n"));

  const result = runFix({ target: root, agent: "all", dryRun: false }, DEFAULT_CONFIG);
  const content = readFileSync(join(root, "AGENTS.md"), "utf8");

  assert.match(content, /pnpm install/);
  assert.match(content, /pnpm test/);
  assert.equal(content.match(new RegExp(DUPLICATE_PARAGRAPH, "g"))?.length, 1);
  assert.ok(result.after.score.overall >= result.before.score.overall);
});

test("fix skips CTX102 missing script autofix", () => {
  const root = makeFixture("fix-ctx102");
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }));
  writeFileSync(join(root, "AGENTS.md"), "Run npm run test:e2e.\n");

  const result = runFix({ target: root, agent: "all", dryRun: false }, DEFAULT_CONFIG);
  const content = readFileSync(join(root, "AGENTS.md"), "utf8");

  assert.equal(content, "Run npm run test:e2e.\n");
  assert.equal(result.skipped.some((fix) => fix.code === "CTX102"), true);
});

test("duplicate paragraph helper is idempotent", () => {
  const content = `${DUPLICATE_PARAGRAPH}\n\n${DUPLICATE_PARAGRAPH}\n`;
  const once = removeDuplicateParagraphs(content);
  const twice = removeDuplicateParagraphs(once);

  assert.equal(once, twice);
});

function makeFixture(name: string): string {
  const root = join(tmpdir(), `ctxscope-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}
