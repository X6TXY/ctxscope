import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { generatePointerContent, runOptimize, undoOptimize } from "../src/skill-pointer.js";
import { scanSkillDir, type SkillInfo } from "../src/skill-scan.js";

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

test("generatePointerContent produces valid markdown with frontmatter", () => {
  const content = generatePointerContent("web-dev", 5, "/home/user/.vault");
  assert.ok(content.includes("web-dev-category-pointer"));
  assert.ok(content.includes("Web Dev Capability Library"));
  assert.ok(content.includes("5"));
  assert.ok(content.includes("/home/user/.vault/web-dev"));
});

test("generatePointerContent handles other", () => {
  const content = generatePointerContent("other", 3, "/tmp/vault");
  assert.ok(content.includes("other-category-pointer"));
  assert.ok(content.includes("Other Capability Library"));
});

test("runOptimize dry-run does not move files", () => {
  const activeDir = makeFixture("optimize-dry");
  const vaultDir = join(tmpdir(), `vault-${Date.now()}`);

  makeSkill(activeDir, "react-components", "React design patterns");
  makeSkill(activeDir, "docker-deploy", "Docker strategies");

  const scanResult = {
    skills: [
      { dirName: "react-components", name: "react-components", description: "React design patterns", path: "", sourceDir: join(activeDir, "react-components"), category: "", descriptionTokens: 10 },
      { dirName: "docker-deploy", name: "docker-deploy", description: "Docker strategies", path: "", sourceDir: join(activeDir, "docker-deploy"), category: "", descriptionTokens: 10 },
    ],
    totalTokenCost: 20,
    dirBreakdown: [],
  };

  const result = runOptimize(scanResult, vaultDir, true);
  assert.ok(result.pointers.length >= 2);
  assert.equal(result.migratedCount, 2);

  // Files should still be in active dir after dry-run
  assert.ok(existsSync(join(activeDir, "react-components", "SKILL.md")));
  assert.ok(existsSync(join(activeDir, "docker-deploy", "SKILL.md")));
});

test("runOptimize migrates skills and generates pointers", () => {
  const activeDir = makeFixture("optimize-real");
  const vaultDir = join(tmpdir(), `vault-${Date.now()}`);

  makeSkill(activeDir, "react-components", "React design patterns");
  makeSkill(activeDir, "docker-deploy", "Docker strategies");

  const scanResult = {
    skills: [
      { dirName: "react-components", name: "react-components", description: "React design patterns", path: "", sourceDir: join(activeDir, "react-components"), category: "", descriptionTokens: 10 },
      { dirName: "docker-deploy", name: "docker-deploy", description: "Docker strategies", path: "", sourceDir: join(activeDir, "docker-deploy"), category: "", descriptionTokens: 10 },
    ],
    totalTokenCost: 20,
    dirBreakdown: [],
  };

  const result = runOptimize(scanResult, vaultDir, false);

  assert.ok(result.pointers.length >= 2);

  // React → web-dev, docker → devops
  const webDevPointer = result.pointers.find((p) => p.category === "web-dev");
  assert.ok(webDevPointer);
  assert.equal(webDevPointer.skillCount, 1);

  // Original files should be gone from active dir
  assert.ok(!existsSync(join(activeDir, "react-components")));
  assert.ok(existsSync(join(activeDir, "web-dev-category-pointer", "SKILL.md")));
  assert.ok(existsSync(join(activeDir, "devops-category-pointer", "SKILL.md")));
});

test("undoOptimize restores skills from vault", () => {
  const activeDir = makeFixture("undo-test");
  const vaultDir = join(tmpdir(), `vault-${Date.now()}`);

  makeSkill(activeDir, "react-components", "React design patterns");
  makeSkill(activeDir, "docker-deploy", "Docker strategies");

  const scanResult = {
    skills: [
      { dirName: "react-components", name: "react-components", description: "React design patterns", path: "", sourceDir: join(activeDir, "react-components"), category: "", descriptionTokens: 10 },
      { dirName: "docker-deploy", name: "docker-deploy", description: "Docker strategies", path: "", sourceDir: join(activeDir, "docker-deploy"), category: "", descriptionTokens: 10 },
    ],
    totalTokenCost: 20,
    dirBreakdown: [],
  };

  runOptimize(scanResult, vaultDir, false);
  assert.ok(!existsSync(join(activeDir, "react-components")));

  const undoResult = undoOptimize([activeDir], vaultDir, false);
  assert.equal(undoResult.restoredCount, 2);
  assert.ok(existsSync(join(activeDir, "react-components", "SKILL.md")));
  assert.ok(existsSync(join(activeDir, "docker-deploy", "SKILL.md")));
});

test("undoOptimize dry-run does not restore", () => {
  const activeDir = makeFixture("undo-dry");
  const vaultDir = join(tmpdir(), `vault-${Date.now()}`);

  makeSkill(activeDir, "react-components", "React design patterns");

  const scanResult = {
    skills: [
      { dirName: "react-components", name: "react-components", description: "React design patterns", path: "", sourceDir: join(activeDir, "react-components"), category: "", descriptionTokens: 10 },
    ],
    totalTokenCost: 10,
    dirBreakdown: [],
  };

  runOptimize(scanResult, vaultDir, false);
  assert.ok(!existsSync(join(activeDir, "react-components")));

  const undoResult = undoOptimize([activeDir], vaultDir, true);
  assert.equal(undoResult.restoredCount, 1);

  // Should still be in vault after dry-run undo
  assert.ok(!existsSync(join(activeDir, "react-components")));
});
