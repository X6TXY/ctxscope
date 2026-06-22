const { test } = await import(`node:${"test"}`);
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { detectRepoFacts } from "../src/repo-facts.js";

function makeFixture(name: string): string {
  const root = join(tmpdir(), `ctxscope-repo-facts-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

test("detects package manager from pnpm lockfile", () => {
  const root = makeFixture("pnpm");
  writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "test", scripts: { build: "echo build" } }));

  const facts = detectRepoFacts(root);
  assert.equal(facts.packageManager, "pnpm");
  assert.equal(facts.packageName, "test");
  assert.deepEqual(facts.scripts, { build: "echo build" });
});

test("detects package manager from npm lockfile", () => {
  const root = makeFixture("npm");
  writeFileSync(join(root, "package-lock.json"), JSON.stringify({ name: "test" }));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "test" }));

  const facts = detectRepoFacts(root);
  assert.equal(facts.packageManager, "npm");
});

test("returns undefined package manager when multiple lockfiles", () => {
  const root = makeFixture("multi");
  writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  writeFileSync(join(root, "yarn.lock"), "# yarn\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({}));

  const facts = detectRepoFacts(root);
  assert.equal(facts.packageManager, undefined);
});

test("detects source directories", () => {
  const root = makeFixture("src");
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({}));

  const facts = detectRepoFacts(root);
  assert.ok(facts.sourceDirectories.includes("src"));
});

test("detects docs directories", () => {
  const root = makeFixture("docs");
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({}));

  const facts = detectRepoFacts(root);
  assert.ok(facts.docsDirectories.includes("docs"));
});

test("reads README headings", () => {
  const root = makeFixture("readme");
  writeFileSync(join(root, "README.md"), "# Overview\n\n## Setup\n\n## Usage\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({}));

  const facts = detectRepoFacts(root);
  assert.ok(facts.readmeHeadings.includes("Overview"));
  assert.ok(facts.readmeHeadings.includes("Setup"));
  assert.ok(facts.readmeHeadings.includes("Usage"));
});

test("handles missing package.json safely", () => {
  const root = makeFixture("no-package");
  const facts = detectRepoFacts(root);
  assert.equal(facts.packageName, undefined);
  assert.deepEqual(facts.scripts, {});
});

test("detects build and test tools from scripts", () => {
  const root = makeFixture("tools");
  writeFileSync(join(root, "package.json"), JSON.stringify({
    name: "test",
    scripts: { build: "tsup", test: "vitest", lint: "eslint" },
  }));

  const facts = detectRepoFacts(root);
  assert.ok(facts.detectedTools.includes("build"));
  assert.ok(facts.detectedTools.includes("test"));
  assert.ok(facts.detectedTools.includes("lint"));
});
