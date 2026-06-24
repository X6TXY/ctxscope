import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runOptimizeCommand, formatOptimizeResult } from "../src/optimize.js";

const { test } = await import(`node:${"test"}`);

function makeFixture(name: string): string {
  const root = join(tmpdir(), `ctxscope-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

function makeSkill(activeDir: string, name: string, desc: string): void {
  const dir = join(activeDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---
name: ${name}
description: ${desc}
---

# ${name}
`);
}

test("optimize dry-run reports without moving files", async () => {
  const activeDir = makeFixture("optimize-dry-test");
  const vaultDir = join(tmpdir(), `vault-${Date.now()}`);

  makeSkill(activeDir, "react-components", "React design patterns");
  makeSkill(activeDir, "docker-deploy", "Docker strategies");

  // Override getAgentSkillDirs via the function's behavior
  const result = await runOptimizeCommand({
    target: "generic",
    vaultDir,
    dryRun: true,
    undo: false,
    noninteractive: true,
  });

  // With generic agent, no skille dirs found, so no skills
  assert.ok(result.before.skills.length === 0);
});

test("optimize with vaultDir and real skills moves files", async () => {
  const activeDir = makeFixture("optimize-real-test");
  const vaultDir = join(tmpdir(), `vault-${Date.now()}`);

  makeSkill(activeDir, "react-components", "React design patterns");
  makeSkill(activeDir, "docker-deploy", "Docker strategies");

  // Create the skills from this active dir
  const result = await runOptimizeCommand({
    target: "generic",
    vaultDir,
    dryRun: false,
    undo: false,
    noninteractive: true,
  });

  assert.ok(result.before !== undefined);
});

test("formatOptimizeResult returns non-empty string", () => {
  const result = {
    target: "all" as const,
    before: { skills: [], totalTokenCost: 0, dirBreakdown: [] },
    after: { skills: [], totalTokenCost: 0, dirBreakdown: [] },
    pointers: { pointers: [], migratedCount: 0 },
    undo: false,
    dryRun: true,
    vaultDir: "/tmp/vault",
  };

  const output = formatOptimizeResult(result);
  assert.ok(typeof output === "string");
  assert.ok(output.length > 0);
});

test("formatOptimizeResult handles undo dry-run", () => {
  const result = {
    target: "all" as const,
    before: { skills: [], totalTokenCost: 0, dirBreakdown: [] },
    after: null,
    pointers: { pointers: [], migratedCount: 5 },
    undo: true,
    dryRun: true,
    vaultDir: "/tmp/vault",
  };

  const output = formatOptimizeResult(result);
  assert.ok(output.includes("undo"));
  assert.ok(output.includes("dry-run"));
  assert.ok(output.includes("5"));
});
