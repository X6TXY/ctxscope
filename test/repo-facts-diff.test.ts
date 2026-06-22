import assert from "node:assert/strict";

import { computeRepoFactsDelta, formatDeltaHuman, type RepoFactsDelta } from "../src/repo-facts-diff.js";
import type { RepoFacts } from "../src/repo-facts.js";

const { test } = await import(`node:${"test"}`);

const EMPTY_FACTS: RepoFacts = {
  scripts: {},
  sourceDirectories: [],
  docsDirectories: [],
  detectedTools: [],
  readmeHeadings: [],
};

test("computeRepoFactsDelta detects no changes for identical facts", () => {
  const delta = computeRepoFactsDelta(EMPTY_FACTS, EMPTY_FACTS);
  assert.equal(delta.hasChanges, false);
});

test("computeRepoFactsDelta detects added scripts", () => {
  const current = { ...EMPTY_FACTS, scripts: { test: "jest", build: "tsc" } };
  const delta = computeRepoFactsDelta(current, EMPTY_FACTS);
  assert.equal(delta.hasChanges, true);
  assert.deepEqual(delta.scriptsAdded.sort(), ["build", "test"]);
});

test("computeRepoFactsDelta detects removed scripts", () => {
  const previous = { ...EMPTY_FACTS, scripts: { test: "jest", build: "tsc" } };
  const delta = computeRepoFactsDelta(EMPTY_FACTS, previous);
  assert.equal(delta.hasChanges, true);
  assert.deepEqual(delta.scriptsRemoved.sort(), ["build", "test"]);
});

test("computeRepoFactsDelta detects changed scripts", () => {
  const current = { ...EMPTY_FACTS, scripts: { test: "vitest" } };
  const previous = { ...EMPTY_FACTS, scripts: { test: "jest" } };
  const delta = computeRepoFactsDelta(current, previous);
  assert.equal(delta.hasChanges, true);
  assert.equal(delta.scriptsChanged.length, 1);
  assert.equal(delta.scriptsChanged[0]?.name, "test");
  assert.equal(delta.scriptsChanged[0]?.before, "jest");
  assert.equal(delta.scriptsChanged[0]?.after, "vitest");
});

test("computeRepoFactsDelta detects package manager change", () => {
  const current = { ...EMPTY_FACTS, packageManager: "pnpm" };
  const previous = { ...EMPTY_FACTS, packageManager: "npm" };
  const delta = computeRepoFactsDelta(current, previous);
  assert.equal(delta.hasChanges, true);
  assert.equal(delta.packageManagerChanged, true);
  assert.equal(delta.packageManagerBefore, "npm");
  assert.equal(delta.packageManagerAfter, "pnpm");
});

test("computeRepoFactsDelta detects source directory changes", () => {
  const current = { ...EMPTY_FACTS, sourceDirectories: ["src", "lib"] };
  const delta = computeRepoFactsDelta(current, EMPTY_FACTS);
  assert.equal(delta.hasChanges, true);
  assert.deepEqual(delta.sourceDirectoriesAdded, ["src", "lib"]);
});

test("computeRepoFactsDelta detects tool changes", () => {
  const current = { ...EMPTY_FACTS, detectedTools: ["next", "vitest"] };
  const delta = computeRepoFactsDelta(current, EMPTY_FACTS);
  assert.equal(delta.hasChanges, true);
  assert.deepEqual(delta.toolsAdded, ["next", "vitest"]);
});

test("formatDeltaHuman returns empty string for no changes", () => {
  const delta: RepoFactsDelta = {
    packageManagerChanged: false,
    scriptsAdded: [],
    scriptsRemoved: [],
    scriptsChanged: [],
    sourceDirectoriesAdded: [],
    sourceDirectoriesRemoved: [],
    toolsAdded: [],
    toolsRemoved: [],
    hasChanges: false,
  };
  const output = formatDeltaHuman(delta);
  assert.equal(output, "");
});

test("formatDeltaHuman shows changes", () => {
  const delta: RepoFactsDelta = {
    packageManagerChanged: true,
    packageManagerBefore: "npm",
    packageManagerAfter: "pnpm",
    scriptsAdded: ["build", "test"],
    scriptsRemoved: ["e2e"],
    scriptsChanged: [{ name: "lint", before: "eslint", after: "biome" }],
    sourceDirectoriesAdded: ["src"],
    sourceDirectoriesRemoved: ["lib"],
    toolsAdded: ["next"],
    toolsRemoved: ["webpack"],
    hasChanges: true,
  };
  const output = formatDeltaHuman(delta);
  assert.ok(output.includes("pnpm"));
  assert.ok(output.includes("build"));
  assert.ok(output.includes("biome"));
  assert.ok(output.includes("next"));
});
